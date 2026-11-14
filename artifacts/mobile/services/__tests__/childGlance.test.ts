/** «نظرة سريعة» on a parent's «المدرسة»: what it counts, and what it refuses to claim. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { GLANCE_DAYS, childGlance, glanceHasContent } from '../childGlance.ts';
import { arHomeworkPhrase } from '../arCount.ts';
import type { FamilyHomework } from '../homework.ts';
import type { MyExam } from '../myExams.ts';

const TODAY = '2026-11-13';

function hw(over: Partial<FamilyHomework> & { id: string }): FamilyHomework {
  return {
    title: 't', instructions: '', dueDate: TODAY, className: '', teacherName: '', done: false, state: 'open',
    examTitle: null, resources: [], canTrack: true, gameResults: [], requiresSubmission: false, submission: 'none',
    ...over,
  };
}

function exam(over: Partial<MyExam> & { evaluationId: string }): MyExam {
  return {
    title: 'Exam', titleAr: 'اختبار', subjectId: 'chemistry', gradeId: 'grade-10', totalMarks: 20, timeLimitMin: null,
    publishedAt: '2026-11-01T08:00:00.000Z', state: 'available', shareCode: null, submittedAt: null, deadlineAt: null,
    result: null, examDate: null, examTime: null,
    ...over,
  };
}

const result = (percent: number) => ({ levelKey: null, percent, earnedMarks: percent / 5, totalMarks: 20, competencyScores: {} as never });

test('counts homework due from today through the next six days, and nothing outside', () => {
  const g = childGlance({
    homework: [
      hw({ id: 'today', dueDate: TODAY }),
      hw({ id: 'day6', dueDate: '2026-11-19' }),
      hw({ id: 'day7', dueDate: '2026-11-20' }), // the eighth day: outside
      hw({ id: 'past', dueDate: '2026-11-12', state: 'overdue' }), // late, not «due»
    ],
    exams: null,
    today: TODAY,
  });
  assert.equal(GLANCE_DAYS, 7);
  assert.equal(g.homework?.dueSoon, 2);
});

test('a tracked item already done is not «due»; an untracked one is (its due day is a calendar fact)', () => {
  const g = childGlance({
    homework: [
      hw({ id: 'done', done: true, state: 'done' }),
      hw({ id: 'untracked', canTrack: false }),
    ],
    exams: null,
    today: TODAY,
  });
  assert.equal(g.homework?.dueSoon, 1);
});

test('«متأخّر» counts exactly the rows that wear the red badge: tracked, not done, overdue', () => {
  const g = childGlance({
    homework: [
      hw({ id: 'late', dueDate: '2026-11-10', state: 'overdue' }),
      hw({ id: 'untracked-late', dueDate: '2026-11-10', state: 'overdue', canTrack: false }),
      hw({ id: 'done-late', dueDate: '2026-11-10', state: 'done', done: true }),
    ],
    exams: null,
    today: TODAY,
  });
  assert.equal(g.homework?.late, 1);
});

test('the next exam is the soonest dated one from today on, with its day', () => {
  const g = childGlance({
    homework: null,
    exams: [
      exam({ evaluationId: 'past', examDate: '2026-11-12' }),
      exam({ evaluationId: 'later', examDate: '2026-11-20' }),
      exam({ evaluationId: 'tomorrow', examDate: '2026-11-14' }),
      exam({ evaluationId: 'undated' }),
    ],
    today: TODAY,
  });
  assert.equal(g.exams?.next?.exam.evaluationId, 'tomorrow');
  assert.equal(g.exams?.next?.day.kind, 'tomorrow');
});

test('the latest result is the released one handed in last; an exam with no result is never it', () => {
  const g = childGlance({
    homework: null,
    exams: [
      exam({ evaluationId: 'old', state: 'result', result: result(60), submittedAt: '2026-10-01T08:00:00.000Z' }),
      exam({ evaluationId: 'new', state: 'result', result: result(85), submittedAt: '2026-11-10T08:00:00.000Z' }),
      exam({ evaluationId: 'waiting', state: 'submitted', submittedAt: '2026-11-12T08:00:00.000Z' }),
    ],
    today: TODAY,
  });
  assert.equal(g.exams?.lastResult?.evaluationId, 'new');
});

test('no exams at all: the exam lines say nothing, not «none»', () => {
  const g = childGlance({ homework: [], exams: [], today: TODAY });
  assert.deepEqual(g.exams, { next: null, lastResult: null });
  assert.deepEqual(g.homework, { dueSoon: 0, late: 0 });
});

test('a list that did not load is null, never zero — and with neither loaded the card is not drawn', () => {
  const g = childGlance({ homework: null, exams: null, today: TODAY });
  assert.equal(g.homework, null);
  assert.equal(g.exams, null);
  assert.equal(glanceHasContent(g), false);
  assert.equal(glanceHasContent(childGlance({ homework: [], exams: null, today: TODAY })), true);
});

test('the Arabic homework count agrees with its number', () => {
  assert.equal(arHomeworkPhrase(1), 'واجب واحد');
  assert.equal(arHomeworkPhrase(2), 'واجبان');
  assert.equal(arHomeworkPhrase(5), '5 واجبات');
  assert.equal(arHomeworkPhrase(12), '12 واجبًا');
});

test('«المدرسة» draws the card for parents only, and hides a list that failed rather than zeroing it', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const school = readFileSync(path.resolve(here, '../../app/(tabs)/school.tsx'), 'utf8');
  assert.match(school, /const glance = isParent\s*\?\s*childGlance\(/);
  assert.match(school, /homework !== null && !hwError \?/);
  assert.match(school, /exams !== null && !examError \?/);
  assert.match(school, /glance && glanceHasContent\(glance\)/);
});

test('every glance line opens with the UI language’s own words, never a name or a title (dir="auto" takes the first strong letter)', async () => {
  const { default: translations } = await import('../i18n.ts');
  const ar = translations.ar;
  const en = translations.en;
  const probe = 'Sara';
  const lines = [
    ar.glanceTitle(probe), ar.glanceNextExam(probe, 'غدًا'), ar.glanceLastResult(85, probe), ar.glanceDue(2), ar.glanceLate(1),
    en.glanceTitle('سارة'), en.glanceNextExam('سارة', 'Tomorrow'), en.glanceLastResult(85, 'سارة'), en.glanceDue(2), en.glanceLate(1),
  ];
  for (const [i, line] of lines.entries()) {
    const first = [...line].find(c => /\p{L}/u.test(c)) ?? '';
    const arabic = /\p{Script=Arabic}/u.test(first);
    assert.equal(arabic, i < 5, `line ${i} starts with «${first}»: ${line}`);
  }
});
