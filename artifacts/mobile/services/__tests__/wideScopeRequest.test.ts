import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_QUESTION_COUNTS, BASE_QUESTION_COUNTS, buildWideRequest, clampCountIndex, distributionFromParam,
  scopeFormState, scopeFromParam, tagQuizLessons, tagWorksheetLessons, visibleCountOptions,
} from '../wideScopeRequest.ts';
import type { AIRequest, QuizOutput, WorksheetOutput } from '../ai/AIService.ts';
import type { ScopeSelection } from '../scopeSelection.ts';

const sem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: 1 };

describe('buildWideRequest', () => {
  it('a semester produces the piece-1 scope, a lesson table and, for balanced, slots', () => {
    const w = buildWideRequest(sem1, 'ar', 12, 'balanced')!;
    assert.ok(w);
    assert.equal(w.fields.scope?.kind, 'semester');
    assert.equal(w.fields.distribution, 'balanced');
    assert.equal(w.fields.coverage?.slots?.length, 12);
    assert.equal(w.fields.coverage?.lessons.length, w.lessons.length);
    assert.equal(w.fields.contextSource, 'curriculum');
    assert.ok((w.fields.additionalContext ?? '').length > 0);
  });

  it('random sends the lesson table but no slots', () => {
    const w = buildWideRequest(sem1, 'ar', 12, 'random')!;
    assert.equal(w.fields.distribution, 'random');
    assert.equal(w.fields.coverage?.slots, undefined);
    assert.ok(w.fields.coverage!.lessons.length > 0);
  });

  it('explicitly clears the single-lesson fields so a merge cannot leave a stale lesson behind', () => {
    const w = buildWideRequest(sem1, 'ar', 10, 'balanced')!;
    for (const k of ['unitId', 'lessonId'] as const) {
      assert.ok(k in w.fields && w.fields[k] === undefined, `${k} must be present and undefined`);
    }
    assert.equal(w.fields.bookFigureCount, 0);
  });

  it('merged over a screen\'s own fields it replaces the lesson-derived context', () => {
    const own = { additionalContext: 'lesson context', lessonId: 'L-x', unitId: 'U-x', bookFigureCount: 3 };
    const w = buildWideRequest(sem1, 'ar', 10, 'balanced')!;
    const merged = { ...own, ...w.fields };
    assert.notEqual(merged.additionalContext, 'lesson context');
    assert.equal(merged.lessonId, undefined);
    assert.equal(merged.unitId, undefined);
    assert.equal(merged.bookFigureCount, 0);
  });

  it('is null for a lesson scope and for one that does not ground', () => {
    assert.equal(buildWideRequest({ kind: 'lesson', gradeId: 'grade-10', subjectId: 'mathematics', lessonId: 'nope' }, 'ar', 10, 'balanced'), null);
    assert.equal(buildWideRequest({ kind: 'unit', gradeId: 'grade-10', subjectId: 'mathematics', unitId: 'no-such-unit' }, 'ar', 10, 'balanced'), null);
  });
});

describe('question counts', () => {
  it('appends 25 and 30 to the existing options without moving them', () => {
    assert.deepEqual([...BASE_QUESTION_COUNTS], [5, 8, 10, 12, 15, 20]);
    assert.deepEqual([...ALL_QUESTION_COUNTS], [5, 8, 10, 12, 15, 20, 25, 30]);
  });

  it('shows 25 and 30 on a wide scope only, and clamps a saved index back inside', () => {
    assert.equal(visibleCountOptions(false), 6);
    assert.equal(visibleCountOptions(true), 8);
    assert.equal(clampCountIndex(7, true), 7);
    assert.equal(clampCountIndex(7, false), 5);
    assert.equal(clampCountIndex(2, false), 2);
  });
});

describe('saved state', () => {
  it('round-trips a scope and a distribution through route params', () => {
    const state = scopeFormState(sem1, 'random');
    assert.deepEqual(scopeFromParam(state.scope), sem1);
    assert.equal(distributionFromParam(state.distribution), 'random');
  });

  it('a material saved before this has neither, and reads as no scope, balanced', () => {
    assert.deepEqual(scopeFormState(null, 'balanced'), {});
    assert.equal(scopeFromParam(undefined), null);
    assert.equal(distributionFromParam(undefined), 'balanced');
  });

  it('refuses junk and a scope that no longer covers anything', () => {
    assert.equal(scopeFromParam('not json'), null);
    assert.equal(scopeFromParam(JSON.stringify({ kind: 'unit', gradeId: 'grade-10', subjectId: 'mathematics', unitId: 'gone' })), null);
    assert.equal(distributionFromParam('sideways'), 'balanced');
  });

  it('a lesson scope is not saved as a wide scope', () => {
    assert.deepEqual(scopeFormState({ kind: 'lesson', gradeId: 'grade-10', subjectId: 'mathematics', lessonId: 'x' }, 'balanced'), {});
  });
});

describe('tagging a live reply', () => {
  const req = {
    coverage: { lessons: [{ code: 'L1', id: 'x1', unitId: 'U', title: 'one' }, { code: 'L2', id: 'x2', unitId: 'U', title: 'two' }] },
  } as unknown as AIRequest;

  it('maps quiz question codes to lesson ids', () => {
    const out = { title: 't', duration: 1, totalPoints: 2, questions: [
      { id: 'q1', type: 'multiple_choice', text: 'a', correctAnswer: 'a', points: 1, explanation: '', lesson: 'L2' },
      { id: 'q2', type: 'true_false', text: 'b', correctAnswer: 'صح', points: 1, explanation: '' },
    ] } as unknown as QuizOutput;
    const tagged = tagQuizLessons(out, req);
    assert.equal(tagged.questions[0]!.lessonId, 'x2');
    assert.equal('lesson' in tagged.questions[0]!, false);
    assert.equal(tagged.questions[1]!.lessonId, undefined);
  });

  it('maps worksheet question codes inside sections', () => {
    const out = { title: 't', instructions: '', sections: [
      { type: 'short_answer', title: 's', questions: [{ text: 'a', points: 1, lesson: 'L1' }] },
    ], answerKey: [] } as unknown as WorksheetOutput;
    assert.equal(tagWorksheetLessons(out, req).sections[0]!.questions[0]!.lessonId, 'x1');
  });

  it('does nothing for a request with no coverage', () => {
    const out = { title: 't', duration: 1, totalPoints: 1, questions: [{ id: 'q1', lesson: 'L1' }] } as unknown as QuizOutput;
    assert.equal(tagQuizLessons(out, {} as AIRequest).questions[0]!.lessonId, undefined);
  });
});
