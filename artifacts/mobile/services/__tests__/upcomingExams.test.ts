import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { examDayKind, formatExamTime, formatExamWhen, groupChildExams, upcomingExams } from '../upcomingExams.ts';
import type { ChildExams, MyExam } from '../myExams.ts';

function exam(over: Partial<MyExam> = {}): MyExam {
  return {
    evaluationId: 'e1', title: 'Quiz', titleAr: 'اختبار', subjectId: 'mathematics', gradeId: 'grade-10',
    totalMarks: 10, timeLimitMin: null, publishedAt: null, state: 'available', shareCode: null,
    submittedAt: null, deadlineAt: null, result: null, ...over,
  };
}
const TODAY = '2026-10-14';
// U+2066 / U+2069: the left-to-right isolate formatDueDate wraps a day in.
const LRI = '⁦';
const PDI = '⁩';

describe('upcomingExams', () => {
  it('keeps today and later, drops the past and anything undated or malformed', () => {
    const list = upcomingExams([
      exam({ evaluationId: 'past', examDate: '2026-10-13' }),
      exam({ evaluationId: 'today', examDate: '2026-10-14' }),
      exam({ evaluationId: 'later', examDate: '2026-10-20' }),
      exam({ evaluationId: 'none', examDate: null }),
      exam({ evaluationId: 'absent' }),
      exam({ evaluationId: 'bad', examDate: '2026-02-30' }),
    ], TODAY);
    assert.deepEqual(list.map(e => e.evaluationId), ['today', 'later']);
  });

  it('sorts by day, then time with untimed last, then title', () => {
    const list = upcomingExams([
      exam({ evaluationId: 'b-untimed', examDate: '2026-10-15', titleAr: 'أ' }),
      exam({ evaluationId: 'b-10', examDate: '2026-10-15', examTime: '10:00' }),
      exam({ evaluationId: 'b-08', examDate: '2026-10-15', examTime: '08:00' }),
      exam({ evaluationId: 'a', examDate: '2026-10-14', examTime: '12:00' }),
    ], TODAY);
    assert.deepEqual(list.map(e => e.evaluationId), ['a', 'b-08', 'b-10', 'b-untimed']);
  });

  it('keeps every state, a closed one included', () => {
    assert.equal(upcomingExams([exam({ state: 'closed', examDate: '2026-10-20' })], TODAY).length, 1);
  });
});

describe('formatting a day', () => {
  it('writes the day DD-MM-YYYY and the time HH:MM, each in a left-to-right isolate', () => {
    assert.equal(formatExamWhen('2026-10-20', '09:30'), `${LRI}20-10-2026${PDI} ${LRI}09:30${PDI}`);
    assert.equal(formatExamWhen('2026-10-20', null), `${LRI}20-10-2026${PDI}`);
    assert.equal(formatExamWhen('2026-10-20', '9:30'), `${LRI}20-10-2026${PDI}`, 'a malformed time is left out');
    assert.equal(formatExamTime('25:00'), null);
  });

  it('says today and tomorrow by the Amman day', () => {
    assert.equal(examDayKind('2026-10-14', TODAY), 'today');
    assert.equal(examDayKind('2026-10-15', TODAY), 'tomorrow');
    assert.equal(examDayKind('2026-10-30', TODAY), 'later');
  });
});

describe('groupChildExams', () => {
  it("puts one child's rows from two teachers under one key, without repeating an exam", () => {
    const children: ChildExams[] = [
      { key: 'k-sara', studentId: 's1', displayName: 'سارة', exams: [exam({ evaluationId: 'x' })] },
      { key: 'k-sara', studentId: 's2', displayName: 'سارة', exams: [exam({ evaluationId: 'y' }), exam({ evaluationId: 'x' })] },
      { key: 'k-adam', studentId: 'a1', displayName: 'آدم', exams: [] },
    ];
    const groups = groupChildExams(children);
    assert.deepEqual(groups.map(g => g.key), ['k-adam', 'k-sara'], 'by name, like the server groups children');
    assert.deepEqual(groups[1]!.exams.map(e => e.evaluationId), ['x', 'y']);
  });

  it('falls back to the roster row id from an older server', () => {
    const groups = groupChildExams([{ studentId: 's1', displayName: 'سارة', exams: [] }]);
    assert.equal(groups[0]!.key, 's1');
  });
});

describe('groupChildExams: one exam under two roster rows', () => {
  const rowsOf = (a: MyExam, b: MyExam): ChildExams[] => [
    { key: 'k', studentId: 's1', displayName: 'سارة', exams: [a] },
    { key: 'k', studentId: 's2', displayName: 'سارة', exams: [b] },
  ];

  it('keeps the released result when the other roster row only has the paper copy (either order)', () => {
    const paper = exam({ evaluationId: 'x', state: 'paper', paper: true });
    const result = exam({ evaluationId: 'x', state: 'result' });
    for (const children of [rowsOf(paper, result), rowsOf(result, paper)]) {
      const [g] = groupChildExams(children);
      assert.deepEqual(g!.exams.map(e => e.state), ['result']);
    }
  });

  it('ranks result > submitted > in_progress > available > paper > closed', () => {
    const order = ['result', 'submitted', 'in_progress', 'available', 'paper', 'closed'] as const;
    for (let i = 0; i < order.length; i++) {
      for (let j = i + 1; j < order.length; j++) {
        const hi = exam({ evaluationId: 'x', state: order[i] });
        const lo = exam({ evaluationId: 'x', state: order[j] });
        for (const children of [rowsOf(hi, lo), rowsOf(lo, hi)]) {
          assert.equal(groupChildExams(children)[0]!.exams[0]!.state, order[i], `${order[i]} beats ${order[j]}`);
        }
      }
    }
  });

  it('keeps the first copy when the two are equally advanced', () => {
    const a = exam({ evaluationId: 'x', state: 'available', shareCode: null, title: 'first' });
    const b = exam({ evaluationId: 'x', state: 'available', title: 'second' });
    assert.equal(groupChildExams(rowsOf(a, b))[0]!.exams[0]!.title, 'first');
  });
});

describe("groupChildExams: a child's merged list is sorted like the server's", () => {
  const ids = (children: ChildExams[]) => groupChildExams(children)[0]!.exams.map(e => e.evaluationId);

  it('puts what can be acted on first, then newest first', () => {
    const children: ChildExams[] = [
      { key: 'k', studentId: 's1', displayName: 'سارة', exams: [
        exam({ evaluationId: 'old-result', state: 'result', publishedAt: '2026-09-01T00:00:00Z' }),
        exam({ evaluationId: 'new-closed', state: 'closed', publishedAt: '2026-10-01T00:00:00Z' }),
      ] },
      { key: 'k', studentId: 's2', displayName: 'سارة', exams: [
        exam({ evaluationId: 'available', state: 'available', publishedAt: '2026-08-01T00:00:00Z' }),
        exam({ evaluationId: 'continuing', state: 'in_progress', publishedAt: '2026-07-01T00:00:00Z' }),
      ] },
    ];
    assert.deepEqual(ids(children), ['continuing', 'available', 'new-closed', 'old-result']);
  });

  it('puts an undated exam after a dated one of the same band, and keeps ties in arrival order', () => {
    const children: ChildExams[] = [
      { key: 'k', studentId: 's1', displayName: 'س', exams: [
        exam({ evaluationId: 'a', state: 'paper', publishedAt: null }),
        exam({ evaluationId: 'b', state: 'paper', publishedAt: '2026-10-01T00:00:00Z' }),
        exam({ evaluationId: 'c', state: 'paper', publishedAt: null }),
      ] },
    ];
    assert.deepEqual(ids(children), ['b', 'a', 'c']);
  });
});
