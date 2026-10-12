import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildMarksRegister, formatMark } from '../marksRegister.ts';

const students = [
  { id: 's1', displayName: 'أحمد' },
  { id: 's2', displayName: 'سارة' },
  { id: 's3', displayName: 'ليث' },
];
const exams = [
  { id: 'e1', title: 'اختبار 1', totalMarks: '10.00' },
  { id: 'e2', title: 'اختبار 2', totalMarks: '20' },
];

test('a missing mark is blank, never zero', () => {
  const reg = buildMarksRegister(students, exams, {
    e1: [{ studentId: 's1', result: { earnedMarks: '7.50', isProvisional: false } }],
    e2: [],
  });
  assert.deepEqual(reg.rows[0]!.marks, [7.5, null]);
  assert.deepEqual(reg.rows[2]!.marks, [null, null]);
});

test('a provisional mark is not a mark yet', () => {
  const reg = buildMarksRegister(students, exams, {
    e1: [{ studentId: 's1', result: { earnedMarks: '9', isProvisional: true } }],
  });
  assert.equal(reg.rows[0]!.marks[0], null);
});

test('total only once every column has a mark', () => {
  const reg = buildMarksRegister(students, exams, {
    e1: [
      { studentId: 's1', result: { earnedMarks: '7.5', isProvisional: false } },
      { studentId: 's2', result: { earnedMarks: '10', isProvisional: false } },
    ],
    e2: [{ studentId: 's1', result: { earnedMarks: '15', isProvisional: false } }],
  });
  assert.equal(reg.rows[0]!.total, 22.5);
  assert.equal(reg.rows[1]!.total, null);
  assert.equal(reg.outOf, 30);
});

test('no exams yields no totals and an empty column list', () => {
  const reg = buildMarksRegister(students, [], {});
  assert.equal(reg.columns.length, 0);
  assert.equal(reg.rows[0]!.total, null);
});

test('formatMark trims numeric(5,2) padding', () => {
  assert.equal(formatMark(7.5), '7.5');
  assert.equal(formatMark(10), '10');
  assert.equal(formatMark(null), '');
});
