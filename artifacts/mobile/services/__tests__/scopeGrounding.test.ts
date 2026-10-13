/**
 * A wide scope is grounded from the lessons it covers — never from a title
 * search — and the prompt block it produces is bounded.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DIGEST_CHAR_BUDGET, resolveScopeGrounding } from '../scopeGrounding.ts';
import { lessonsInScope, scopeKey, type ScopeSelection } from '../scopeSelection.ts';
import { resolveGeneratorGrounding } from '../kbContext.ts';
import { getLessonsForUnit, getUnitsForSubjectGrade } from '../knowledgeBase.ts';

const G = 'grade-10';
const maths = (n: 1 | 2): ScopeSelection => ({ kind: 'semester', gradeId: G, subjectId: 'mathematics', semester: n });
const book = (subjectId: string): ScopeSelection => ({ kind: 'book', gradeId: G, subjectId });

describe('resolveScopeGrounding — wide scopes', () => {
  it('is grounded without any title lookup and lists every lesson in range', () => {
    const g = resolveScopeGrounding(maths(1), 'ar');
    assert.equal(g.grounded, true);
    assert.equal(g.kind, 'semester');
    assert.equal(g.scopeKey, scopeKey(maths(1)));
    assert.deepEqual(g.lessons.map(l => l.id), lessonsInScope(maths(1)).map(l => l.id));
    assert.equal(g.ungroundedNote, '');
    for (const l of g.lessons) assert.ok(g.context.includes(l.titleAr), `missing lesson «${l.titleAr}»`);
  });

  it('the two semesters give different contexts and disjoint lessons', () => {
    const a = resolveScopeGrounding(maths(1), 'ar');
    const b = resolveScopeGrounding(maths(2), 'ar');
    assert.notEqual(a.context, b.context);
    assert.equal(a.lessons.filter(l => b.lessons.some(m => m.id === l.id)).length, 0);
  });

  it('names the scope at the top of the block, in the asked language', () => {
    assert.ok(resolveScopeGrounding(maths(1), 'ar').context.startsWith('📚 النطاق: الفصل الأول كاملًا'));
    assert.ok(resolveScopeGrounding(maths(2), 'en').context.startsWith('📚 Scope: Entire semester 2'));
  });

  it('always fits the budget, and says so when it had to cut — even for a 100-lesson English book', () => {
    for (const sel of [maths(1), book('mathematics'), book('chemistry'), book('english')]) {
      const g = resolveScopeGrounding(sel, 'en');
      assert.ok(g.context.length <= DIGEST_CHAR_BUDGET + 200, `${scopeKey(sel)}: ${g.context.length} chars`);
    }
    const english = resolveScopeGrounding(book('english'), 'en');
    if (english.truncated) assert.ok(/not listed|omitted/i.test(english.context), 'truncated but not said');
  });

  it('degrades detail before it drops lessons: a full maths semester still lists every lesson', () => {
    const g = resolveScopeGrounding(book('mathematics'), 'ar');
    assert.equal(g.truncated, false);
    for (const l of g.lessons) assert.ok(g.context.includes(l.titleAr));
  });

  it('carries only NCCD unit ids (a subject without them yields none, but is still grounded)', () => {
    const m = resolveScopeGrounding(maths(1), 'ar');
    assert.ok(m.unitIds.length > 0);
    assert.ok(m.unitIds.every(id => id.startsWith('kbu-') && id.includes('-nccd-')), m.unitIds.join());
    assert.equal(new Set(m.unitIds).size, m.unitIds.length);
  });

  it('an unknown scope is ungrounded with the standard note — it never falls back to a title search', () => {
    const g = resolveScopeGrounding({ kind: 'unit', gradeId: G, subjectId: 'mathematics', unitId: 'no-such-unit' }, 'ar');
    assert.equal(g.grounded, false);
    assert.equal(g.context, '');
    assert.deepEqual(g.lessons, []);
    assert.equal(g.ungroundedNote, resolveGeneratorGrounding('', 'ar').ungroundedNote);
    assert.ok(g.ungroundedNote.length > 0);
  });
});

describe('resolveScopeGrounding — a single lesson is today\'s grounding', () => {
  it('matches resolveGeneratorGrounding for the same lesson id', () => {
    const lesson = getLessonsForUnit(getUnitsForSubjectGrade('mathematics', G)[0]!.id)[0]!;
    const sel: ScopeSelection = { kind: 'lesson', gradeId: G, subjectId: 'mathematics', lessonId: lesson.id };
    const g = resolveScopeGrounding(sel, 'ar');
    const today = resolveGeneratorGrounding(lesson.titleAr, 'ar', { lessonId: lesson.id });
    assert.equal(g.grounded, today.grounded);
    assert.equal(g.context, today.context);
    assert.deepEqual(g.lessons.map(l => l.id), [lesson.id]);
  });
});
