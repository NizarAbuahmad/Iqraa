import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EXTERNAL_RESOURCES, isUnitScopedTag } from '@workspace/curriculum';
import {
  askAboutResourceMessage,
  buildLessonShelf,
  type LessonShelf,
} from '../lessonShelf.ts';
import { KB_LESSONS, getBookForLesson } from '../knowledgeBase.ts';
import { unitTagsForLesson } from '../mathSupportResources.ts';

const lessonsBySubject = (subjectId: string) =>
  KB_LESSONS.filter(l => getBookForLesson(l)?.subjectId === subjectId);

const shelves = (): LessonShelf[] =>
  KB_LESSONS.map(l => buildLessonShelf(l.id)).filter((s): s is LessonShelf => s !== null);

const flat = (s: LessonShelf) => [...s.unit, ...s.semester].flatMap(g => g.items);

describe('buildLessonShelf', () => {
  it('returns null for an id that names no lesson', () => {
    assert.equal(buildLessonShelf('no-such-lesson'), null);
  });

  it('builds a shelf for every lesson in the catalog', () => {
    assert.equal(shelves().length, KB_LESSONS.length);
  });

  it('counts what it holds', () => {
    for (const s of shelves()) {
      assert.equal(s.total, flat(s).length, s.lessonId);
      assert.equal(s.referenceOnly, flat(s).filter(r => r.usePolicy === 'reference-only').length);
      assert.ok(s.referenceOnly <= s.total);
    }
  });

  it('puts a document in exactly one scope', () => {
    // A file tagged both `s1-u2` and `s1` is about the circle unit. Listing it
    // in both places would double the count and make the split meaningless.
    for (const s of shelves()) {
      const ids = flat(s).map(r => r.id);
      assert.equal(new Set(ids).size, ids.length, `${s.lessonId} lists a file twice`);
    }
  });

  it('sorts unit-scoped material by unit tag and the rest by breadth', () => {
    for (const s of shelves()) {
      for (const r of s.unit.flatMap(g => g.items)) {
        assert.ok(
          r.unitTags.some(t => isUnitScopedTag(t) && s.unitTags.includes(t)),
          `${s.lessonId}: ${r.id} is in the unit scope without a matching unit tag`,
        );
      }
      for (const r of s.semester.flatMap(g => g.items)) {
        assert.ok(
          !r.unitTags.some(t => isUnitScopedTag(t) && s.unitTags.includes(t)),
          `${s.lessonId}: ${r.id} belongs in the unit scope`,
        );
      }
    }
  });
});

describe('the circle unit, which is the case worth naming', () => {
  const circle = KB_LESSONS.find(l => /أوتار الدائرة/.test(l.titleAr));

  it('leads with the material about the circle, not the semester', () => {
    assert.ok(circle, 'the circle lesson is missing from the catalog');
    const s = buildLessonShelf(circle.id)!;
    const unitItems = s.unit.flatMap(g => g.items);
    assert.ok(unitItems.length >= 8, `only ${unitItems.length} unit-scoped items`);
    assert.ok(unitItems.every(r => r.unitTags.includes('s1-u2')));
    // The point of the merge: worksheets, question banks and answer keys are
    // three separate kinds here. Under the old vocabulary the middle one did
    // not exist and its files were typed `quiz` alongside the past papers.
    const kinds = s.unit.map(g => g.kind);
    assert.ok(kinds.includes('worksheet'));
    assert.ok(kinds.includes('question-bank'));
  });

  it('orders worksheets ahead of the official books', () => {
    const s = buildLessonShelf(circle!.id)!;
    const order = [...s.unit, ...s.semester].map(g => g.kind);
    const ws = order.indexOf('worksheet');
    const book = order.lastIndexOf('student-book');
    if (ws >= 0 && book >= 0) assert.ok(ws < book, 'the textbook outranks the worksheets');
  });

  it('finds the past papers, which no query could reach before', () => {
    const s = buildLessonShelf(circle!.id)!;
    const exams = [...s.unit, ...s.semester].filter(g => g.kind === 'exam').flatMap(g => g.items);
    assert.ok(exams.length > 0, 'no past papers on a Semester 1 maths lesson');
    for (const e of exams) {
      assert.ok(!e.unitTags.includes('remedial'), `${e.id} still tagged remedial`);
    }
  });
});

describe('subject isolation', () => {
  it('never shelves a document from another subject', () => {
    // «تجربة استهلالية: المعادلة الكيميائية» matched the maths title rule
    // /معادل/ and pulled six algebra worksheets onto a chemistry lab. Chat
    // survived it because `scoreResource` rejects a subject mismatch; the
    // shelf reads tags directly and had no such backstop.
    for (const lesson of KB_LESSONS) {
      const subjectId = getBookForLesson(lesson)?.subjectId;
      const s = buildLessonShelf(lesson.id);
      if (!subjectId || !s) continue;
      for (const r of flat(s)) {
        assert.equal(r.subjectId, subjectId, `${lesson.id} (${subjectId}) shelved ${r.titleAr}`);
      }
    }
  });

  it('emits no other subject\'s unit tag, for any lesson', () => {
    // Stronger than the financial-literacy case: assert the whole namespace.
    const prefixFor: Record<string, RegExp> = {
      // Grade 10 math tags are bare (`s1-u2`); every other grade gets an
      // explicit `g{n}-` prefix (`g9-math-s1-u2`) — see bankTagsForParsedUnit.
      mathematics: /^(s[12](-u\d+|-matrices)?|g10-math-general|g9-math-s[12](-u\d+)?|g8-math-s[12](-u\d+)?)$/,
      // Chemistry is `unitLevel: true` in curriculumIds.ts, so a lesson emits
      // BOTH the semester scope and the narrower unit scope — `g9-chem-s1` and
      // `g9-chem-s1-u1`. The `(-u\d+)?` is doing real work here; a Grade 9
      // pattern copied from the source-side vocabulary in bank.test.ts, where
      // documents only ever carry the semester tag, fails on the unit form.
      chemistry: /^(chem-s[12](-u\d+)?|chem-g10-general|g9-chem-s[12](-u\d+)?)$/,
      // Grade 10 tag is bare (`finlit-s1`); Grade 9 gets the explicit
      // `g9-` prefix like arabic and islamic below.
      'financial-literacy': /^(finlit-s[12]|g9-finlit-s[12]|g8-finlit-s[12])$/,
      // Grade 10 Arabic predates this map and was silently unchecked — no
      // entry meant `continue`, not a pass. Added on 2026-09-08 alongside the
      // Grade 9 Arabic S1 book, so both grades are covered from here on.
      // Grade 8 joined 2026-09-10, semester 1 then semester 2.
      arabic: /^(arabic-s[12]|g9-arabic-s[12]|g8-arabic-s[12])$/,
      // Grade 10 Islamic predates this map too and was likewise silently
      // unchecked. Added alongside the Grade 9 Islamic books.
      // Grade 8 joined 2026-09-10, semester 1 then semester 2.
      islamic: /^(islamic-s[12]|g9-islamic-s[12]|g8-islamic-s[12])$/,
      // Geography is new to this repo entirely. Grade 10 (curriculumIds.ts's
      // implicit grade) carries a bare tag; Grade 9 carries the explicit
      // g9- form, same split as every pre-existing subject above.
      geography: /^(geo-s[12]|g9-geo-s[12])$/,
      // Same as geography — Grade 10 gained a book the same week.
      history: /^(hist-s[12]|g9-hist-s[12])$/,
      // Same again — Grade 10 gained a book on 2026-09-10, so both the bare
      // and the g9- form appear.
      'civic-education': /^(civ-s[12]|g9-civ-s[12])$/,
      'physical-education': /^g9-pe-s[12]$/,
      // Grade 8's combined «العلوم» book, the only one this subject has. No
      // grade-10 alternative here: Grade 10 splits science into the four
      // subjects above, so there is no bare `science-s[12]` form to allow.
      science: /^g8-science-s[12]$/,
    };
    for (const lesson of KB_LESSONS) {
      const subjectId = getBookForLesson(lesson)?.subjectId;
      const pattern = subjectId ? prefixFor[subjectId] : undefined;
      if (!pattern) continue;
      for (const tag of unitTagsForLesson(lesson)) {
        assert.match(tag, pattern, `${lesson.id} (${subjectId}) emitted ${tag}`);
      }
    }
  });

  it('leaves financial literacy with an empty shelf, and says so honestly', () => {
    // Not "no lesson" and not an error — a real empty. Its S1 book is usable
    // but held out of the app view while the edition conflict is unresolved.
    for (const lesson of lessonsBySubject('financial-literacy')) {
      const s = buildLessonShelf(lesson.id);
      assert.ok(s, `${lesson.id} produced no shelf at all`);
      assert.equal(s.total, 0, `${lesson.id} shelved ${s.total}`);
    }
  });

  it('gives the subjects that do have material a real shelf', () => {
    for (const subject of ['mathematics', 'chemistry']) {
      const withItems = lessonsBySubject(subject)
        .filter(l => (buildLessonShelf(l.id)?.total ?? 0) > 0).length;
      assert.ok(withItems > 0, `no ${subject} lesson shelved anything`);
    }
  });
});

/**
 * Curated third-party material is a separate list from the bank, and the
 * separation is load-bearing: these attach to a lesson id rather than a unit
 * tag, they carry a licence rather than an authority, and every one requires
 * its credit rendered next to it. Counting them into `total` would put them
 * under a "we cannot hand you these files" note that is false of them.
 */
describe('external resources on the shelf', () => {
  const lessonWithExternal = EXTERNAL_RESOURCES[0]?.lessonIds[0];

  it('attaches curated resources to the lesson they name', () => {
    assert.ok(lessonWithExternal, 'the manifest is empty — this test proves nothing');
    const shelf = buildLessonShelf(lessonWithExternal);
    assert.ok(shelf, `no lesson found for ${lessonWithExternal}`);
    assert.ok(shelf.external.length > 0);
  });

  it('keeps them out of the bank counts', () => {
    const shelf = buildLessonShelf(lessonWithExternal!)!;
    const bankItems = [...shelf.unit, ...shelf.semester].reduce((n, g) => n + g.items.length, 0);
    assert.equal(shelf.total, bankItems);
  });

  it('carries an attribution on every one, because the licence requires it', () => {
    for (const r of EXTERNAL_RESOURCES) {
      assert.ok(r.attribution.trim().length > 0, r.id);
    }
  });

  it('gives a lesson with no curated material an empty list, not a missing one', () => {
    // The panel reads `.length`, so `undefined` here would crash a lesson page
    // rather than render nothing.
    const bare = KB_LESSONS.find(l => buildLessonShelf(l.id)?.external.length === 0);
    assert.ok(bare, 'every lesson has external material — unexpected');
    assert.deepEqual(buildLessonShelf(bare.id)!.external, []);
  });
});

describe('askAboutResourceMessage', () => {
  it('names the document and the lesson in both languages', () => {
    const s = buildLessonShelf(KB_LESSONS.find(l => /أوتار الدائرة/.test(l.titleAr))!.id)!;
    const r = s.unit[0]!.items[0]!;
    const ar = askAboutResourceMessage(r, s.topic, 'ar');
    assert.ok(ar.includes(r.titleAr));
    assert.ok(ar.includes(s.topic));
    const en = askAboutResourceMessage(r, s.topic, 'en');
    assert.ok(en.includes(r.titleAr));
  });
});
