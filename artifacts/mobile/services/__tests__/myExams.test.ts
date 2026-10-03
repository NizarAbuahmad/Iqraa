import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  MY_EXAM_STATE_KEY,
  actionableCount,
  myExamAction,
  myExamTitle,
  subjectLabel,
  type MyExam,
} from '../myExams.ts';

function exam(over: Partial<MyExam> = {}): MyExam {
  return {
    evaluationId: 'e1',
    title: 'Quiz',
    titleAr: 'اختبار قصير',
    subjectId: 'mathematics',
    gradeId: 'grade-10',
    totalMarks: 10,
    timeLimitMin: null,
    publishedAt: '2026-10-01T08:00:00.000Z',
    state: 'available',
    shareCode: 'ABC234',
    submittedAt: null,
    deadlineAt: null,
    result: null,
    ...over,
  };
}

const RESULT = { levelKey: 'proficient' as const, percent: 80, earnedMarks: 8, totalMarks: 10, competencyScores: {} as never };

describe('myExamAction', () => {
  it('starts an open exam and continues a started one', () => {
    assert.equal(myExamAction(exam()), 'start');
    assert.equal(myExamAction(exam({ state: 'in_progress' })), 'continue');
  });

  it('never follows a link the server did not send', () => {
    assert.equal(myExamAction(exam({ state: 'available', shareCode: null })), null);
    assert.equal(myExamAction(exam({ state: 'closed', shareCode: null })), null);
  });

  it('expands a released result in place', () => {
    assert.equal(myExamAction(exam({ state: 'result', shareCode: null, result: RESULT })), 'toggle_result');
  });

  it('does nothing for a paper waiting to be marked', () => {
    assert.equal(myExamAction(exam({ state: 'submitted' })), null);
  });
});

describe('actionableCount', () => {
  it('counts only what the student can open now', () => {
    assert.equal(
      actionableCount([
        exam(),
        exam({ state: 'in_progress' }),
        exam({ state: 'submitted' }),
        exam({ state: 'result', result: RESULT }),
        exam({ state: 'closed', shareCode: null }),
      ]),
      2,
    );
  });
});

describe('labels', () => {
  it('names every state the server can send', () => {
    for (const s of ['available', 'in_progress', 'submitted', 'result', 'closed'] as const) {
      assert.ok(MY_EXAM_STATE_KEY[s], s);
    }
  });

  it('falls back across languages for a title', () => {
    assert.equal(myExamTitle({ title: 'Quiz', titleAr: '' }, 'ar'), 'Quiz');
    assert.equal(myExamTitle({ title: '', titleAr: 'اختبار' }, 'en'), 'اختبار');
  });

  it('resolves a subject name, and says nothing for an unknown id', () => {
    assert.ok(subjectLabel('mathematics', 'ar'));
    assert.equal(subjectLabel('no-such-subject', 'ar'), null);
  });
});
