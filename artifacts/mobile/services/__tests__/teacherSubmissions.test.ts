/** The teacher's reading of the class's project submissions: tolerant normalizers and the one rule for opening a row. */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  firstParam,
  formatHandedInAt,
  normalizeTeacherSubmissionDetail,
  normalizeTeacherSubmissionList,
  rememberSubmissionsFlash,
  rowOpensDetail,
  rowState,
  takeSubmissionsFlash,
} from '../teacherSubmissions.ts';

const ROW = { studentId: 's1', displayName: 'سارة', status: 'submitted', submittedAt: '2026-10-30T08:00:00.000Z', photoCount: 2 };
const HW = { id: 'h1', title: 'مشروع', dueDate: '2026-10-31' };

describe('normalizeTeacherSubmissionList', () => {
  it('keeps a well-formed list', () => {
    assert.deepEqual(
      normalizeTeacherSubmissionList({ homework: HW, submittedCount: 1, trackableCount: 3, submissions: [{ ...ROW, hasAccount: true }] }),
      { homework: HW, submittedCount: 1, trackableCount: 3, submissions: [{ ...ROW, hasAccount: true }] },
    );
  });

  it('reads only an explicit false as «no account»; a missing or odd flag is an account (an older server)', () => {
    const flags = [false, true, undefined, null, 0, 'false'].map(
      hasAccount => normalizeTeacherSubmissionList({ submissions: [{ ...ROW, hasAccount }] }).submissions[0]!.hasAccount,
    );
    assert.deepEqual(flags, [false, true, true, true, true, true]);
  });

  it('takes trackableCount from the server, and reads a missing or odd one as the number of rows', () => {
    const rows = [ROW, { ...ROW, studentId: 's2' }, { ...ROW, studentId: 's3' }];
    assert.equal(normalizeTeacherSubmissionList({ trackableCount: 2, submissions: rows }).trackableCount, 2);
    assert.equal(normalizeTeacherSubmissionList({ trackableCount: 0, submissions: rows }).trackableCount, 0);
    for (const odd of [undefined, null, '2', -1, NaN]) {
      const out = normalizeTeacherSubmissionList({ trackableCount: odd, submissions: rows });
      assert.equal(out.trackableCount, odd === -1 || Number.isNaN(odd) ? 0 : 3, String(odd));
    }
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
      assert.equal(out.trackableCount, 0);
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

  it('is null when the submission is missing or not an object: a reply without a project is not an empty project', () => {
    const student = { id: 's1', displayName: 'سارة' };
    assert.equal(normalizeTeacherSubmissionDetail({ student }), null);
    for (const submission of [null, 'x', 7, [], undefined]) {
      assert.equal(normalizeTeacherSubmissionDetail({ student, submission }), null, JSON.stringify(submission));
    }
  });

  it('still reads an empty object as an empty project (the server sent one)', () => {
    const out = normalizeTeacherSubmissionDetail({ student: { id: 's1', displayName: 'سارة' }, submission: {} });
    assert.equal(out?.submission.status, 'none');
    assert.deepEqual(out?.submission.photos, []);
  });
});

describe('firstParam', () => {
  it('takes a route param as one string: the first of an array, empty for nothing', () => {
    assert.equal(firstParam('h1'), 'h1');
    assert.equal(firstParam(['h1', 'h2']), 'h1');
    assert.equal(firstParam([]), '');
    assert.equal(firstParam(undefined), '');
  });
});

describe('formatHandedInAt', () => {
  const AT = '2026-10-30T08:05:00.000Z';
  const ARABIC_INDIC = /[٠-٩]/;

  it('writes a date and a time, in Latin digits in Arabic and in English', () => {
    for (const lang of ['ar', 'en'] as const) {
      const out = formatHandedInAt(AT, lang);
      assert.ok(out, lang);
      assert.ok(!ARABIC_INDIC.test(out), out);
      assert.match(out, /2026/, out);
      assert.match(out, /\b11:05\b|\b11.05\b/, `${lang}: the time of day in Amman (UTC+3), got ${out}`);
    }
  });

  it('never writes the first minutes of the day as «24:05» (hour12:false does on some ICU builds)', () => {
    // 21:05 UTC is 00:05 the next day in Amman (UTC+3).
    for (const lang of ['ar', 'en'] as const) {
      const out = formatHandedInAt('2026-10-30T21:05:00.000Z', lang);
      assert.ok(out, lang);
      assert.match(out, /\b00:05\b/, `${lang}: got ${out}`);
      assert.doesNotMatch(out, /24:05/, `${lang}: got ${out}`);
    }
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'teacherSubmissions.ts'), 'utf8');
    assert.match(src, /hourCycle: 'h23'/);
    assert.doesNotMatch(src, /hour12/);
  });

  it('is null for nothing, or a string that is not a moment', () => {
    for (const bad of [null, undefined, '', 'yesterday']) assert.equal(formatHandedInAt(bad, 'ar'), null, String(bad));
  });
});

describe('the note that survives a navigation', () => {
  it('is handed over once, then gone', () => {
    takeSubmissionsFlash('h1');
    assert.equal(takeSubmissionsFlash('h1'), null);
    rememberSubmissionsFlash('subDeleted', 'h1');
    assert.equal(takeSubmissionsFlash('h1'), 'subDeleted');
    assert.equal(takeSubmissionsFlash('h1'), null);
  });

  it('keeps the newest when two are left', () => {
    rememberSubmissionsFlash('subDeleted', 'h1');
    rememberSubmissionsFlash('subAlreadyGone', 'h1');
    assert.equal(takeSubmissionsFlash('h1'), 'subAlreadyGone');
  });

  it("is for one homework's list only: another homework's list gets nothing, and the note is dropped, not kept for later", () => {
    rememberSubmissionsFlash('subDeleted', 'h1');
    assert.equal(takeSubmissionsFlash('h2'), null);
    assert.equal(takeSubmissionsFlash('h1'), null, 'a list that was not the target still consumes it');
  });
});

describe('rowOpensDetail', () => {
  it('opens a handed-in row, on time or late, and nothing else', () => {
    assert.equal(rowOpensDetail({ status: 'none' }), false);
    assert.equal(rowOpensDetail({ status: 'submitted' }), true);
    assert.equal(rowOpensDetail({ status: 'late' }), true);
  });
});

describe('rowState', () => {
  it('is «noAccount» only for a record that has not handed in and has no account', () => {
    assert.equal(rowState({ status: 'none', hasAccount: false }), 'noAccount');
    assert.equal(rowState({ status: 'none', hasAccount: true }), 'none');
  });

  it('keeps the hand-in state of a record whose account was unlinked afterwards', () => {
    assert.equal(rowState({ status: 'submitted', hasAccount: false }), 'submitted');
    assert.equal(rowState({ status: 'late', hasAccount: false }), 'late');
    assert.equal(rowOpensDetail({ status: 'late' }), true);
  });
});
