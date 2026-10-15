import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  MY_EXAM_STATE_KEY,
  actionableCount,
  canRetakeExam,
  myExamAction,
  metaSegments,
  myExamTitle,
  progressSummary,
  splitMyExams,
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

  // A pin, not a RED test: a paper row carries no share code, so the existing
  // `!shareCode` line already returns null. It holds the rule if that line moves.
  it('never offers anything on a paper exam', () => {
    assert.equal(myExamAction(exam({ state: 'paper', shareCode: null, paper: true })), null);
    // Even if an older server still sent a code.
    assert.equal(myExamAction(exam({ state: 'paper', shareCode: 'ABC234', paper: true })), null);
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
    for (const s of ['available', 'in_progress', 'submitted', 'result', 'closed', 'paper'] as const) {
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

describe('canRetakeExam', () => {
  const shown = exam({ state: 'result', result: RESULT });

  it('offers a retake on a released result the server lists', () => {
    assert.equal(canRetakeExam(shown, ['e1'], false), true);
  });

  it('never offers one beside a paper still waiting for the teacher', () => {
    assert.equal(canRetakeExam(exam({ state: 'submitted' }), ['e1'], false), false);
  });

  it('never offers one to a parent, or on a quiz the server did not list', () => {
    assert.equal(canRetakeExam(shown, ['e1'], true), false);
    assert.equal(canRetakeExam(shown, [], false), false);
  });
});

describe('metaSegments', () => {
  it('keeps the pieces in order and drops the empty ones', () => {
    assert.deepEqual(metaSegments(['الرياضيات', null, 'موعده 2026-10-17 09:30', false, '', '   ', undefined, '10 علامات']), [
      'الرياضيات',
      'موعده 2026-10-17 09:30',
      '10 علامات',
    ]);
    assert.deepEqual(metaSegments([null, undefined, '']), []);
  });
  it('carries no separator character, so no wrapped line can end or start on a dot', () => {
    for (const s of metaSegments(['a', 'b', 'c'])) assert.ok(!/[·\u00A0]/.test(s), s);
    assert.deepEqual(metaSegments(['الرياضيات']), ['الرياضيات']);
  });
});

describe('splitMyExams', () => {
  it('puts open exams up front, soonest planned day first and undated last', () => {
    const { upcoming, past } = splitMyExams([
      exam({ evaluationId: 'undated' }),
      exam({ evaluationId: 'later', examDate: '2026-10-25' }),
      exam({ evaluationId: 'sooner', examDate: '2026-10-20', state: 'in_progress' }),
      exam({ evaluationId: 'done', state: 'result', shareCode: null, result: RESULT, submittedAt: '2026-10-02T08:00:00.000Z' }),
    ]);
    assert.deepEqual(upcoming.map(e => e.evaluationId), ['sooner', 'later', 'undated']);
    assert.deepEqual(past.map(e => e.evaluationId), ['done']);
  });

  it('lists what is over newest first, with a paper awaiting its mark among them', () => {
    const { upcoming, past } = splitMyExams([
      exam({ evaluationId: 'old', state: 'closed', shareCode: null, submittedAt: null, publishedAt: '2026-09-01T08:00:00.000Z' }),
      exam({ evaluationId: 'new', state: 'submitted', shareCode: null, submittedAt: '2026-10-05T08:00:00.000Z' }),
    ]);
    assert.equal(upcoming.length, 0);
    assert.deepEqual(past.map(e => e.evaluationId), ['new', 'old']);
  });
});

describe('progressSummary', () => {
  it('has nothing to average before any result is released', () => {
    const none = progressSummary([exam(), exam({ evaluationId: 'w', state: 'submitted', shareCode: null })]);
    assert.deepEqual(none, { taken: 0, averagePercent: null, bySubject: [] });
  });

  it('averages released results only, overall and per subject', () => {
    const r = (percent: number) => ({ ...RESULT, percent });
    const s = progressSummary([
      exam({ evaluationId: 'a', state: 'result', shareCode: null, result: r(90) }),
      exam({ evaluationId: 'b', state: 'result', shareCode: null, result: r(70) }),
      exam({ evaluationId: 'c', state: 'result', shareCode: null, subjectId: 'chemistry', result: r(50) }),
      exam({ evaluationId: 'waiting', state: 'submitted', shareCode: null }),
    ]);
    assert.equal(s.taken, 3);
    assert.equal(s.averagePercent, 70);
    assert.deepEqual(s.bySubject, [
      { subjectId: 'mathematics', percent: 80, count: 2 },
      { subjectId: 'chemistry', percent: 50, count: 1 },
    ]);
  });
});
