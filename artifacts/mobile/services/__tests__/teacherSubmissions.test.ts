/** The teacher's reading of the class's project submissions: tolerant normalizers and the one rule for opening a row. */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeTeacherSubmissionDetail,
  normalizeTeacherSubmissionList,
  rowOpensDetail,
} from '../teacherSubmissions.ts';

const ROW = { studentId: 's1', displayName: 'سارة', status: 'submitted', submittedAt: '2026-10-30T08:00:00.000Z', photoCount: 2 };
const HW = { id: 'h1', title: 'مشروع', dueDate: '2026-10-31' };

describe('normalizeTeacherSubmissionList', () => {
  it('keeps a well-formed list', () => {
    assert.deepEqual(normalizeTeacherSubmissionList({ homework: HW, submittedCount: 1, submissions: [ROW] }), {
      homework: HW,
      submittedCount: 1,
      submissions: [ROW],
    });
  });

  it('drops a row with no student id, and reads an unknown status as none', () => {
    const out = normalizeTeacherSubmissionList({
      homework: HW,
      submittedCount: 0,
      submissions: [{ ...ROW, studentId: '' }, { ...ROW, studentId: undefined }, null, 'x', { ...ROW, studentId: 's2', status: 'graded' }],
    });
    assert.equal(out.submissions.length, 1);
    assert.equal(out.submissions[0]!.studentId, 's2');
    assert.equal(out.submissions[0]!.status, 'none');
  });

  it('reads a photoCount that is not a number as 0, and a missing submittedAt as null', () => {
    const [row] = normalizeTeacherSubmissionList({
      homework: HW,
      submittedCount: 0,
      submissions: [{ studentId: 's3', displayName: 'علي', status: 'none', photoCount: '2' }],
    }).submissions;
    assert.equal(row!.photoCount, 0);
    assert.equal(row!.submittedAt, null);
  });

  it('survives garbage: an empty list, zero count, blank homework', () => {
    for (const raw of [null, undefined, 'x', [], {}]) {
      const out = normalizeTeacherSubmissionList(raw);
      assert.deepEqual(out.submissions, []);
      assert.equal(out.submittedCount, 0);
      assert.deepEqual(out.homework, { id: '', title: '', dueDate: '' });
    }
  });

  it('reads a negative or non-numeric submittedCount as 0', () => {
    assert.equal(normalizeTeacherSubmissionList({ submittedCount: -3 }).submittedCount, 0);
    assert.equal(normalizeTeacherSubmissionList({ submittedCount: '4' }).submittedCount, 0);
  });
});

describe('normalizeTeacherSubmissionDetail', () => {
  it('keeps the student and normalizes the submission', () => {
    const out = normalizeTeacherSubmissionDetail({
      student: { id: 's1', displayName: 'سارة' },
      submission: { status: 'late', locked: true, note: 'ملاحظة', photos: [{ id: 'p1', url: 'https://x/p1.jpg', mime: 'image/jpeg', sizeBytes: 5 }], submittedAt: '2026-11-01T08:00:00.000Z' },
    });
    assert.ok(out);
    assert.deepEqual(out.student, { id: 's1', displayName: 'سارة' });
    assert.equal(out.submission.status, 'late');
    assert.equal(out.submission.note, 'ملاحظة');
    assert.equal(out.submission.photos.length, 1);
  });

  it('is null when the student is missing or has no id', () => {
    assert.equal(normalizeTeacherSubmissionDetail({ submission: {} }), null);
    assert.equal(normalizeTeacherSubmissionDetail({ student: { id: '', displayName: 'x' }, submission: {} }), null);
    assert.equal(normalizeTeacherSubmissionDetail({ student: 'x' }), null);
    assert.equal(normalizeTeacherSubmissionDetail(null), null);
  });

  it('reads a missing submission as an empty one', () => {
    const out = normalizeTeacherSubmissionDetail({ student: { id: 's1', displayName: 'سارة' } });
    assert.equal(out?.submission.status, 'none');
    assert.deepEqual(out?.submission.photos, []);
  });
});

describe('rowOpensDetail', () => {
  it('opens a handed-in row, on time or late, and nothing else', () => {
    assert.equal(rowOpensDetail({ status: 'none' }), false);
    assert.equal(rowOpensDetail({ status: 'submitted' }), true);
    assert.equal(rowOpensDetail({ status: 'late' }), true);
  });
});
