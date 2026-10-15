/**
 * What a "scope" is, and which lessons it covers.
 *
 * Run: pnpm --filter @workspace/mobile test  (or node --test on this file via
 * the package's test script, which registers the `@workspace/*` alias).
 *
 * The assertions are derived from the KB itself rather than hard-coded lesson
 * ids, so they keep holding when a book's lessons change.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  availableKinds, lessonsInScope, LEGACY_SCOPE_KINDS, parseScope, scopeKey, scopeLabel,
  semestersAvailable, unitsInScope, type ScopeSelection,
} from '../scopeSelection.ts';
import { getLessonsForUnit, getUnitsForSubjectGrade } from '../knowledgeBase.ts';

const G = 'grade-10';
const S = 'mathematics';
const book: ScopeSelection = { kind: 'book', gradeId: G, subjectId: S };
const sem = (n: 1 | 2): ScopeSelection => ({ kind: 'semester', gradeId: G, subjectId: S, semester: n });
const firstUnit = getUnitsForSubjectGrade(S, G)[0]!;

describe('lessonsInScope', () => {
  it('the two semesters are non-empty and, in order, make up the book', () => {
    const all = lessonsInScope(book).map(l => l.id);
    const s1 = lessonsInScope(sem(1)).map(l => l.id);
    const s2 = lessonsInScope(sem(2)).map(l => l.id);
    assert.ok(s1.length > 0 && s2.length > 0, 'a semester of the maths book is empty');
    assert.deepEqual([...s1, ...s2], all);
  });

  it('a unit is exactly its own lessons, in order', () => {
    const sel: ScopeSelection = { kind: 'unit', gradeId: G, subjectId: S, unitId: firstUnit.id };
    assert.deepEqual(
      lessonsInScope(sel).map(l => l.id),
      getLessonsForUnit(firstUnit.id).map(l => l.id),
    );
  });

  it('a lesson is just that lesson', () => {
    const lesson = getLessonsForUnit(firstUnit.id)[0]!;
    const sel: ScopeSelection = { kind: 'lesson', gradeId: G, subjectId: S, lessonId: lesson.id };
    assert.deepEqual(lessonsInScope(sel).map(l => l.id), [lesson.id]);
  });

  it('an id that is not in this grade+subject covers nothing', () => {
    assert.deepEqual(lessonsInScope({ kind: 'unit', gradeId: G, subjectId: S, unitId: 'no-such-unit' }), []);
    assert.deepEqual(lessonsInScope({ kind: 'lesson', gradeId: G, subjectId: S, lessonId: 'no-such-lesson' }), []);
    // A real maths unit asked for under another subject must not leak across.
    assert.deepEqual(lessonsInScope({ kind: 'unit', gradeId: G, subjectId: 'chemistry', unitId: firstUnit.id }), []);
  });
});

describe('unitsInScope', () => {
  it('a semester only holds units of that semester\'s book', () => {
    const s1 = unitsInScope(sem(1));
    const s2 = unitsInScope(sem(2));
    assert.ok(s1.length > 0 && s2.length > 0);
    assert.equal(s1.filter(u => s2.some(v => v.id === u.id)).length, 0);
  });
});

describe('semestersAvailable / availableKinds', () => {
  it('maths has both semesters; a one-book subject has one', () => {
    assert.deepEqual(semestersAvailable(G, S), [1, 2]);
    assert.deepEqual(semestersAvailable(G, 'financial-literacy'), [1]);
  });

  it('hides the semester entry when there is only one semester (it would equal the whole book)', () => {
    assert.ok(availableKinds(G, S, ['lesson', 'unit', 'semester', 'book']).includes('semester'));
    assert.ok(!availableKinds(G, 'financial-literacy', ['lesson', 'unit', 'semester', 'book']).includes('semester'));
  });

  it('keeps `semester` off under DEMO_MODE, and leaves today\'s kinds alone', () => {
    const all = ['lesson', 'unit', 'semester', 'book'] as const;
    assert.deepEqual(availableKinds(G, S, all, true), ['lesson', 'unit', 'book']);
  });

  it('defaults to exactly what the picker offers today', () => {
    assert.deepEqual(availableKinds(G, S), [...LEGACY_SCOPE_KINDS]);
  });

  it('offers nothing when the grade+subject has no book', () => {
    assert.deepEqual(availableKinds('grade-10', 'no-such-subject'), []);
  });
});

describe('scopeKey', () => {
  it('is id-only, stable, and distinct per scope', () => {
    const lesson = getLessonsForUnit(firstUnit.id)[0]!;
    const keys = [
      scopeKey(book), scopeKey(sem(1)), scopeKey(sem(2)),
      scopeKey({ kind: 'unit', gradeId: G, subjectId: S, unitId: firstUnit.id }),
      scopeKey({ kind: 'lesson', gradeId: G, subjectId: S, lessonId: lesson.id }),
    ];
    assert.equal(new Set(keys).size, keys.length);
    assert.equal(scopeKey(sem(1)), scopeKey(sem(1)));
    assert.equal(scopeKey(sem(1)), `sem:${G}:${S}:1`);
  });

  it('refuses a selection that is missing the id its kind needs', () => {
    assert.throws(() => scopeKey({ kind: 'semester', gradeId: G, subjectId: S }));
    assert.throws(() => scopeKey({ kind: 'unit', gradeId: G, subjectId: S }));
    assert.throws(() => scopeKey({ kind: 'lesson', gradeId: G, subjectId: S }));
  });
});

describe('scopeLabel', () => {
  it('names a wide scope in Arabic and English', () => {
    assert.equal(scopeLabel(book, 'ar'), 'الكتاب كاملًا');
    assert.equal(scopeLabel(sem(1), 'ar'), 'الفصل الأول كاملًا');
    assert.equal(scopeLabel(sem(2), 'ar'), 'الفصل الثاني كاملًا');
    assert.equal(scopeLabel(book, 'en'), 'Entire book');
    assert.equal(scopeLabel(sem(2), 'en'), 'Entire semester 2');
  });

  it('uses the unit / lesson title for those kinds', () => {
    const lesson = getLessonsForUnit(firstUnit.id)[0]!;
    assert.equal(scopeLabel({ kind: 'unit', gradeId: G, subjectId: S, unitId: firstUnit.id }, 'ar'), firstUnit.titleAr);
    assert.equal(scopeLabel({ kind: 'lesson', gradeId: G, subjectId: S, lessonId: lesson.id }, 'en'), lesson.titleEn);
  });
});

describe('parseScope', () => {
  it('round-trips a valid selection through JSON', () => {
    const back = parseScope(JSON.parse(JSON.stringify(sem(2))));
    assert.deepEqual(back, sem(2));
  });

  it('rejects junk and selections that cover nothing', () => {
    assert.equal(parseScope(null), null);
    assert.equal(parseScope('book'), null);
    assert.equal(parseScope({ kind: 'galaxy', gradeId: G, subjectId: S }), null);
    assert.equal(parseScope({ kind: 'unit', gradeId: G, subjectId: S, unitId: 'no-such-unit' }), null);
    assert.equal(parseScope({ kind: 'semester', gradeId: G, subjectId: S, semester: 3 }), null);
  });
});
