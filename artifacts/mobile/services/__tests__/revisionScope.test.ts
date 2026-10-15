/**
 * What a one-session revision over a unit / semester / book covers.
 *
 * The real Grade 10 maths books are used and every expectation is derived
 * from the KB (lesson order, outcomes), not from copied strings, so a KB edit
 * moves the expectation with it. Number agreement in the "left out" sentence
 * is pinned on hand-built units, where the count is chosen.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  leftOutSentence, revisionPhrase, revisionUnits, revisionUnitsFromLessons, scopeFromKey, splitShown,
  REVISION_SHOWN_PER_UNIT, type RevisionUnit,
} from '../revisionScope.ts';
import { curriculumObjectivesFor } from '../kbContext.ts';
import { getLessonById } from '../knowledgeBase.ts';
import { lessonsInScope, scopeKey, unitsInScope, type ScopeSelection } from '../scopeSelection.ts';

const G = 'grade-10';
const sem = (n: 1 | 2): ScopeSelection => ({ kind: 'semester', gradeId: G, subjectId: 'mathematics', semester: n });
const book: ScopeSelection = { kind: 'book', gradeId: G, subjectId: 'mathematics' };

describe('revisionUnits — real Grade 10 maths', () => {
  for (const n of [1, 2] as const) {
    it(`semester ${n}: one entry per unit, book order, every lesson exactly once`, () => {
      const units = revisionUnits(sem(n), 'ar');
      assert.deepEqual(units.map(u => u.unitId), unitsInScope(sem(n)).map(u => u.id));
      assert.deepEqual(units.flatMap(u => u.lessons.map(l => l.id)), lessonsInScope(sem(n)).map(l => l.id));
      assert.deepEqual(units.map(u => u.title), unitsInScope(sem(n)).map(u => u.titleAr));
    });

    it(`semester ${n}: at most three outcomes, concepts and terms per unit, none empty`, () => {
      for (const u of revisionUnits(sem(n), 'ar')) {
        for (const list of [u.outcomes, u.concepts, u.terms]) {
          assert.ok(list.length <= 3, `${u.title}: ${list.length}`);
          assert.ok(list.every(s => s.trim().length > 0), u.title);
          assert.equal(new Set(list).size, list.length, `${u.title}: duplicate`);
        }
        assert.ok(u.outcomes.length > 0, `${u.title} has no outcome`);
      }
    });
  }

  it('the first outcome of each lesson comes first, and a lab with nothing to review comes last', () => {
    // Semester 1, unit 1 opens with a GeoGebra lab (no concepts, no terms) and then four lessons.
    const u = revisionUnits(sem(1), 'ar')[0]!;
    const thin = u.lessons.filter(l => l.thin);
    assert.ok(thin.length >= 1 && u.lessons[0]!.thin, 'probe: unit 1 should open with a thin lesson');
    const rich = u.lessons.filter(l => !l.thin).map(l => getLessonById(l.id)!);
    assert.deepEqual(u.outcomes, rich.slice(0, 3).map(l => curriculumObjectivesFor(l)[0]!));
  });

  it('English uses the English titles and concepts', () => {
    const ar = revisionUnits(sem(2), 'ar');
    const en = revisionUnits(sem(2), 'en');
    assert.deepEqual(en.map(u => u.title), unitsInScope(sem(2)).map(u => u.titleEn));
    assert.deepEqual(en.map(u => u.lessons.length), ar.map(u => u.lessons.length));
  });

  it('is empty when nothing is in scope', () => {
    assert.deepEqual(revisionUnits({ kind: 'unit', gradeId: G, subjectId: 'mathematics', unitId: 'gone' }, 'ar'), []);
  });
});

describe('revisionUnitsFromLessons — the offline path rebuilds units from the request', () => {
  it('equals revisionUnits for the same lessons', () => {
    for (const sel of [sem(1), sem(2), book]) {
      assert.deepEqual(revisionUnitsFromLessons(lessonsInScope(sel).map(l => l.id), 'ar'), revisionUnits(sel, 'ar'));
    }
  });

  it('skips ids the KB does not hold and ignores repeats', () => {
    const ids = lessonsInScope(sem(1)).map(l => l.id);
    assert.deepEqual(revisionUnitsFromLessons(['nope', ...ids, ids[0]!], 'ar'), revisionUnits(sem(1), 'ar'));
    assert.deepEqual(revisionUnitsFromLessons(['nope'], 'ar'), []);
  });
});

describe('splitShown', () => {
  it('shows at most N per unit, prefers lessons with content, keeps book order in both lists', () => {
    for (const u of revisionUnits(book, 'ar')) {
      const { shown, left } = splitShown(u, REVISION_SHOWN_PER_UNIT);
      assert.equal(shown.length, Math.min(REVISION_SHOWN_PER_UNIT, u.lessons.length));
      assert.equal(shown.length + left.length, u.lessons.length);
      const at = (id: string) => u.lessons.findIndex(l => l.id === id);
      assert.deepEqual(shown.map(l => at(l.id)), [...shown.map(l => at(l.id))].sort((a, b) => a - b));
      if (left.some(l => !l.thin)) assert.ok(shown.every(l => !l.thin), `${u.title}: a thin lesson shown while a rich one is left out`);
    }
  });
});

const L = (n: number, unitId = 'U') => Array.from({ length: n }, (_, i) => ({ id: `${unitId}${i}`, title: `د${unitId}${i + 1}`, thin: false }));
const unit = (n: number, unitId = 'U'): RevisionUnit => ({ unitId, title: unitId, lessons: L(n, unitId), outcomes: [], concepts: [], terms: [] });

describe('leftOutSentence', () => {
  it('is empty when every unit fits', () => {
    assert.equal(leftOutSentence([unit(3), unit(2, 'V')], 3, 'ar'), '');
    assert.equal(leftOutSentence([unit(3)], 3, 'en'), '');
  });

  it('agrees the Arabic noun with the count: 1, 2, 3–10, 11+', () => {
    assert.ok(leftOutSentence([unit(4)], 3, 'ar').includes('درس واحد:'));
    assert.ok(leftOutSentence([unit(5)], 3, 'ar').includes('درسان:'));
    assert.ok(leftOutSentence([unit(6)], 3, 'ar').includes('3 دروس:'));
    assert.ok(leftOutSentence([unit(13)], 3, 'ar').includes('10 دروس:'));
    assert.ok(leftOutSentence([unit(14)], 3, 'ar').includes('11 درسًا:'));
  });

  it('names at most six titles and counts the rest, agreed', () => {
    const s7 = leftOutSentence([unit(10)], 3, 'ar'); // 7 left: 6 named + 1
    assert.ok(s7.endsWith('ودرس آخر.'), s7);
    assert.ok(leftOutSentence([unit(11)], 3, 'ar').endsWith('ودرسان آخران.'));
    assert.ok(leftOutSentence([unit(12)], 3, 'ar').endsWith('و3 دروس أخرى.'));
    assert.ok(leftOutSentence([unit(20)], 3, 'ar').endsWith('و11 درسًا آخر.'));
    assert.ok(leftOutSentence([unit(20)], 3, 'en').endsWith('and 11 more.'));
  });

  it('names exactly the lessons each unit cannot show, from every unit', () => {
    const units = [unit(5), unit(4, 'V')];
    const s = leftOutSentence(units, 3, 'ar');
    for (const t of ['دU4', 'دU5', 'دV4']) assert.ok(s.includes(`«${t}»`), `${t} missing: ${s}`);
    for (const t of ['دU1', 'دU3', 'دV3']) assert.ok(!s.includes(`«${t}»`), `${t} is shown, not left out: ${s}`);
  });

  it('English counts in English', () => {
    assert.ok(leftOutSentence([unit(4)], 3, 'en').includes('leaves out 1 lesson:'));
    assert.ok(leftOutSentence([unit(6)], 3, 'en').includes('leaves out 3 lessons:'));
  });

  it('on the real book, every lesson is either shown or named as left out', () => {
    const units = revisionUnits(book, 'ar');
    const s = leftOutSentence(units, REVISION_SHOWN_PER_UNIT, 'ar');
    const left = units.flatMap(u => splitShown(u, REVISION_SHOWN_PER_UNIT).left);
    assert.ok(left.length > 0, 'probe: the whole book should not fit one session');
    assert.ok(s.includes(left.length <= 10 ? `${left.length} دروس` : `${left.length} درسًا`), s);
  });
});

describe('revisionPhrase', () => {
  it('names a semester, the book and a unit as a noun phrase, in both languages', () => {
    assert.equal(revisionPhrase(sem(1), 'ar'), 'موضوعات الفصل الأول');
    assert.equal(revisionPhrase(sem(2), 'ar'), 'موضوعات الفصل الثاني');
    assert.equal(revisionPhrase(sem(1), 'en'), 'Semester 1 topics');
    assert.equal(revisionPhrase(book, 'ar'), 'موضوعات الكتاب كله');
    assert.equal(revisionPhrase(book, 'en'), 'whole-book topics');
    const u = unitsInScope(sem(1))[1]!;
    const unitSel: ScopeSelection = { kind: 'unit', gradeId: G, subjectId: 'mathematics', unitId: u.id };
    assert.equal(revisionPhrase(unitSel, 'ar'), `موضوعات وحدة «${u.titleAr}»`);
    assert.equal(revisionPhrase(unitSel, 'en'), `“${u.titleEn}” unit topics`);
  });

  it('is never the picker label («… كاملًا»)', () => {
    for (const sel of [sem(1), sem(2), book]) assert.ok(!revisionPhrase(sel, 'ar').includes('كاملًا'));
  });
});

describe('scopeFromKey — what the offline generator reads off a request', () => {
  it('round-trips every kind through its key', () => {
    const u = unitsInScope(sem(2))[0]!;
    const lesson = lessonsInScope(sem(2))[2]!;
    const sels: ScopeSelection[] = [
      sem(1), sem(2), book,
      { kind: 'unit', gradeId: G, subjectId: 'mathematics', unitId: u.id },
      { kind: 'lesson', gradeId: G, subjectId: 'mathematics', lessonId: lesson.id },
    ];
    for (const sel of sels) assert.deepEqual(scopeFromKey(scopeKey(sel)), sel);
  });

  it('is null for junk and for a scope that no longer covers anything', () => {
    for (const k of ['', 'book', 'sem:grade-10:mathematics:3', 'unit:gone', 'lesson:gone', 'book:grade-99:mathematics', 'x:y']) {
      assert.equal(scopeFromKey(k), null, k);
    }
  });
});
