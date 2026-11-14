import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXAM_TYPE_ORDER, FIRST_GRADE_DEFAULT_TYPES, FIRST_GRADE_EVALUATION_TYPES, evaluationTypesForGrade,
} from '../index.ts';

describe('the question types of a Grade 1 evaluation', () => {
  it('drop the written-answer types for Grade 1 only', () => {
    const asked = ['multiple_choice', 'short_answer', 'open_ended', 'problem_solving', 'fill_blank', 'practical_task'];
    assert.deepEqual(evaluationTypesForGrade('grade-1', asked), ['multiple_choice', 'fill_blank', 'practical_task']);
    for (const g of ['grade-2', 'grade-10', null, undefined]) assert.deepEqual(evaluationTypesForGrade(g, asked), asked);
  });

  it('every allowed type is a paper type, and the default is allowed', () => {
    for (const t of FIRST_GRADE_EVALUATION_TYPES) assert.ok(EXAM_TYPE_ORDER.includes(t), t);
    for (const t of FIRST_GRADE_DEFAULT_TYPES) assert.ok((FIRST_GRADE_EVALUATION_TYPES as readonly string[]).includes(t), t);
    for (const t of ['short_answer', 'open_ended', 'problem_solving', 'read_aloud', 'dictation']) {
      assert.ok(!(FIRST_GRADE_EVALUATION_TYPES as readonly string[]).includes(t), t);
    }
  });
});
