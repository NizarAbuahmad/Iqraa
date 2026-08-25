import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isUnitScopedTag } from '@workspace/curriculum';
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
      mathematics: /^(s[12](-u\d+|-matrices)?|g10-math-general)$/,
      chemistry: /^(chem-s[12](-u\d+)?|chem-g10-general)$/,
      'financial-literacy': /^finlit-s[12]$/,
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
