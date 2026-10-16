/**
 * `buildScopeRequest` — what a teaching tool (lesson plan, activity,
 * classroom builder, slides, lesson-flow) adds to its request for a unit,
 * semester or book. Unlike the assessment tools' `buildWideRequest`, it must
 * KEEP the teacher's own text and its provenance.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildScopeRequest } from '../wideScopeRequest.ts';
import { isRevisionRequest, type AIRequest } from '../ai/AIService.ts';
import { buildAdaptationsDirective } from '../kbContext.ts';
import { lessonsInScope, type ScopeSelection } from '../scopeSelection.ts';
import { revisionUnits } from '../revisionScope.ts';

const sem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: 1 };

describe('buildScopeRequest', () => {
  it('a semester carries the scope, the digest and the lesson table without slots', () => {
    const w = buildScopeRequest(sem1, 'ar')!;
    assert.equal(w.fields.scope?.kind, 'semester');
    assert.equal(w.fields.scope?.scopeKey, 'sem:grade-10:mathematics:1');
    assert.equal(w.fields.additionalContext, w.grounding.context);
    assert.equal(w.fields.contextSource, 'curriculum');
    assert.deepEqual(w.fields.coverage?.lessons.map(l => l.id), lessonsInScope(sem1).map(l => l.id));
    assert.equal('slots' in (w.fields.coverage ?? {}), false);
    assert.deepEqual(w.units, revisionUnits(sem1, 'ar'));
  });

  it('explicitly clears the single-lesson fields, so a merge cannot leave a stale lesson behind', () => {
    const w = buildScopeRequest(sem1, 'ar')!;
    for (const k of ['unitId', 'lessonId'] as const) {
      assert.ok(k in w.fields && w.fields[k] === undefined, `${k} must be present and undefined`);
    }
    assert.equal(w.fields.bookFigureCount, 0);
    const merged = { lessonId: 'L-x', unitId: 'U-x', bookFigureCount: 3, ...w.fields };
    assert.equal(merged.lessonId, undefined);
    assert.equal(merged.unitId, undefined);
    assert.equal(merged.bookFigureCount, 0);
  });

  it('keeps the teacher\'s own text after the digest, and keeps it the teacher\'s', () => {
    const directive = buildAdaptationsDirective('بسّط الشرح لطالب يعاني من عسر القراءة', 'ar');
    const w = buildScopeRequest(sem1, 'ar', { additionalContext: directive, contextSource: 'teacher' })!;
    assert.equal(w.fields.additionalContext, `${w.grounding.context}\n\n${directive.trim()}`);
    assert.equal(w.fields.contextSource, 'teacher');
  });

  it('a typed objective alone (no context text) still keeps the request the teacher\'s', () => {
    // The lesson-plan screen puts objectives in their own field, so `own` has no text, only the decision.
    const w = buildScopeRequest(sem1, 'ar', { contextSource: 'teacher' })!;
    assert.equal(w.fields.contextSource, 'teacher');
    assert.equal(w.fields.additionalContext, w.grounding.context);
  });

  it('curriculum-only stays curriculum; text without a stated source is read as the teacher\'s', () => {
    assert.equal(buildScopeRequest(sem1, 'ar', { contextSource: 'curriculum' })!.fields.contextSource, 'curriculum');
    assert.equal(buildScopeRequest(sem1, 'ar', { additionalContext: 'note' })!.fields.contextSource, 'teacher');
    assert.equal(buildScopeRequest(sem1, 'ar', { additionalContext: '   ' })!.fields.contextSource, 'curriculum');
  });

  it('merged LAST over a screen\'s own request, the teacher\'s text survives', () => {
    const own = { additionalContext: 'teacher note', contextSource: 'teacher' as const, lessonId: 'L-x' };
    const merged = { ...own, ...buildScopeRequest(sem1, 'ar', own)!.fields };
    assert.ok(merged.additionalContext!.endsWith('teacher note'));
    assert.equal(merged.contextSource, 'teacher');
    assert.equal(merged.lessonId, undefined);
  });

  it('is null for a lesson scope and for one that does not ground', () => {
    const lessonId = lessonsInScope(sem1)[0]!.id;
    assert.equal(buildScopeRequest({ kind: 'lesson', gradeId: 'grade-10', subjectId: 'mathematics', lessonId }, 'ar'), null);
    assert.equal(buildScopeRequest({ kind: 'unit', gradeId: 'grade-10', subjectId: 'mathematics', unitId: 'gone' }, 'ar'), null);
  });
});

describe('isRevisionRequest', () => {
  it('is true exactly when the request carries a scope', () => {
    const w = buildScopeRequest(sem1, 'ar')!;
    assert.equal(isRevisionRequest({ ...({} as AIRequest), ...w.fields }), true);
    assert.equal(isRevisionRequest({} as AIRequest), false);
    // A lesson table alone (no scope) is not a revision request: the gate is the scope.
    assert.equal(isRevisionRequest({ coverage: w.fields.coverage } as AIRequest), false);
  });
});
