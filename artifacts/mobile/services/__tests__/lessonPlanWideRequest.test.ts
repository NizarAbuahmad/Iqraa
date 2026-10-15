/**
 * The lesson-plan screen's request for a unit / semester / book.
 *
 * The screen itself cannot be loaded by `node --test`; this is the decision it
 * delegates to: the form's own request, the teacher's text kept and kept
 * private, nothing re-derived from the scope's label, no prior review.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildWideLessonPlanRequest, buildScopeRequest } from '../wideScopeRequest.ts';
import { buildAdaptationsDirective } from '../kbContext.ts';
import { lessonsInScope, type ScopeSelection } from '../scopeSelection.ts';
import type { LessonPlanForm } from '../generatorRequests.ts';

const sem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: 1 };
const form = (over: Partial<LessonPlanForm> = {}): LessonPlanForm => ({
  gradeName: 'الصف العاشر', subjectName: 'Mathematics', topic: 'الفصل الأول كاملًا', lang: 'ar',
  durationMinutes: 45, teachingStyle: 'collaborative', objectives: '', adaptations: '', priorTopicsNotes: '',
  includePriorReview: false, ...over,
});

describe('buildWideLessonPlanRequest', () => {
  it('carries the form\'s own fields and the scope, with no lesson re-derived from the label', () => {
    const req = buildWideLessonPlanRequest(form(), sem1)!;
    assert.equal(req.teachingStyle, 'collaborative');
    assert.equal(req.duration, 45);
    assert.equal(req.topic, 'الفصل الأول كاملًا');
    assert.equal(req.ministryRoles, true);
    assert.equal(req.scope?.scopeKey, 'sem:grade-10:mathematics:1');
    assert.deepEqual(req.coverage?.lessons.map(l => l.id), lessonsInScope(sem1).map(l => l.id));
    assert.equal(req.lessonId, undefined);
    assert.equal(req.unitId, undefined);
    assert.equal(req.bookFigureCount, 0);
    assert.equal(req.contextSource, 'curriculum');
    assert.equal(req.additionalContext, buildScopeRequest(sem1, 'ar')!.grounding.context);
  });

  it('a typed objective keeps the plan the teacher\'s, and is sent as the objective', () => {
    const req = buildWideLessonPlanRequest(form({ objectives: 'أن يربط الطالب بين الوحدات' }), sem1)!;
    assert.equal(req.objectives, 'أن يربط الطالب بين الوحدات');
    assert.equal(req.contextSource, 'teacher');
  });

  it('a typed adaptation rides after the digest and keeps the plan the teacher\'s', () => {
    const adaptations = 'بسّط الشرح';
    const req = buildWideLessonPlanRequest(form({ adaptations }), sem1)!;
    const directive = buildAdaptationsDirective(adaptations, 'ar').trim();
    assert.ok(directive.length > 0, 'probe: the directive is not empty');
    assert.ok(req.additionalContext!.endsWith(directive), req.additionalContext);
    assert.ok(req.additionalContext!.startsWith('📚'), 'the digest comes first');
    assert.equal(req.contextSource, 'teacher');
  });

  it('no lesson context rides after the digest: the teacher\'s text is the only thing added', () => {
    const adaptations = 'بسّط الشرح';
    const req = buildWideLessonPlanRequest(form({ adaptations }), sem1)!;
    const digest = buildScopeRequest(sem1, 'ar')!.grounding.context;
    const directive = buildAdaptationsDirective(adaptations, 'ar').trim();
    assert.equal(req.additionalContext, `${digest}\n\n${directive}`);
  });

  it('asks for no prior review, and notes that are not sent do not make the plan private', () => {
    const req = buildWideLessonPlanRequest(form({ includePriorReview: true, priorTopicsNotes: 'الكسور' }), sem1)!;
    assert.equal(req.includePriorReview, false);
    assert.equal(req.priorKnowledge, undefined);
    assert.equal(req.priorTopicsNotes, undefined);
    assert.equal(req.contextSource, 'curriculum');
  });

  it('a Regenerate carries the regeneration fields through', () => {
    const req = buildWideLessonPlanRequest(form({ regenerate: true, previous: { mainActivity: 'x' } }), sem1)!;
    assert.equal(req.regenerate, true);
  });

  it('is null for a lesson scope and for one that does not ground', () => {
    const lessonId = lessonsInScope(sem1)[0]!.id;
    assert.equal(buildWideLessonPlanRequest(form(), { kind: 'lesson', gradeId: 'grade-10', subjectId: 'mathematics', lessonId }), null);
    assert.equal(buildWideLessonPlanRequest(form(), { kind: 'unit', gradeId: 'grade-10', subjectId: 'mathematics', unitId: 'gone' }), null);
  });
});
