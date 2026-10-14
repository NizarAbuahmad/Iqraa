/**
 * Saving a class scan must never overwrite a paper it did not create, and a
 * retry must never skip a paper it did.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { saveRows, type SaveDeps } from '../classScanSave.ts';
import {
  assignStudent,
  discardRow,
  isStudentLocked,
  newRow,
  rowFromScan,
  setMark,
  type ReviewContext,
  type ReviewRow,
} from '../classScanReview.ts';
import type { ClassScanResponse } from '../evaluations.ts';

const QS = [
  { id: 'q1', number: 1, maxMarks: 5 },
  { id: 'q2', number: 2, maxMarks: 10 },
];
const ctx = (hasAttempt: string[] = []): ReviewContext => ({ questions: QS, hasAttempt: new Set(hasAttempt) });

const scan = (studentId: string, marks: Record<string, number>): ClassScanResponse => ({
  nameRead: 'x',
  match: { status: 'confident', studentId, candidates: [] },
  proposals: Object.entries(marks).map(([questionId, awardedMarks], i) => ({ questionId, number: i + 1, awardedMarks, readAs: String(awardedMarks) })),
  skipped: [],
  writtenTotal: null,
  model: 'm',
  saved: false,
});
const row = (key: string, studentId: string, marks: Record<string, number> = { q1: 4, q2: 7 }) =>
  rowFromScan(newRow(key), scan(studentId, marks));

function fakeDeps(over: Partial<SaveDeps> = {}) {
  const calls: string[] = [];
  const deps: SaveDeps = {
    async startAttempt(_e, studentId) { calls.push(`start:${studentId}`); return { attemptId: `att-${studentId}`, created: true }; },
    async setGrade(a, q, m) { calls.push(`grade:${a}:${q}:${m}`); },
    async submit(a) { calls.push(`submit:${a}`); },
    ...over,
  };
  return { deps, calls };
}

/** Apply patches the way the screen's state does, so a second call sees them. */
function store(rows: ReviewRow[]) {
  const byKey = new Map(rows.map(r => [r.key, r]));
  return {
    onPatch: (key: string, patch: Partial<ReviewRow>) => byKey.set(key, { ...byKey.get(key)!, ...patch }),
    get: (key: string) => byKey.get(key)!,
    all: () => [...byKey.values()],
  };
}

describe('saveRows', () => {
  it('starts, marks every filled box, then submits — in that order', async () => {
    const { deps, calls } = fakeDeps();
    const s = store([row('a', 's1')]);
    await saveRows('e1', s.all(), ctx(), deps, s.onPatch);
    assert.deepEqual(calls, ['start:s1', 'grade:att-s1:q1:4', 'grade:att-s1:q2:7', 'submit:att-s1']);
    assert.equal(s.get('a').state, 'saved');
  });

  it('leaves a blank box unmarked — it writes no zero', async () => {
    const { deps, calls } = fakeDeps();
    const s = store([row('a', 's1', { q1: 4 })]);
    await saveRows('e1', s.all(), ctx(), deps, s.onPatch);
    assert.deepEqual(calls, ['start:s1', 'grade:att-s1:q1:4', 'submit:att-s1']);
  });

  it('NEVER writes into a paper it did not create', async () => {
    const { deps, calls } = fakeDeps({
      async startAttempt() { calls.push('start'); return { attemptId: 'theirs', created: false }; },
    });
    const s = store([row('a', 's1')]);
    await saveRows('e1', s.all(), ctx(), deps, s.onPatch);
    assert.deepEqual(calls, ['start'], 'no grade, no submit');
    assert.equal(s.get('a').state, 'skipped_existing');
  });

  it('skips a student the screen already knew had a paper, without even starting', async () => {
    const { deps, calls } = fakeDeps();
    const s = store([row('a', 's1')]);
    await saveRows('e1', s.all(), ctx(['s1']), deps, s.onPatch);
    assert.deepEqual(calls, []);
    assert.equal(s.get('a').state, 'skipped_existing');
  });

  it('a failure on one row does not stop the others', async () => {
    const { deps, calls } = fakeDeps({
      async setGrade(a, q, m) { if (a === 'att-s1') throw new Error('boom'); calls.push(`grade:${a}:${q}:${m}`); },
    });
    const s = store([row('a', 's1'), row('b', 's2')]);
    await saveRows('e1', s.all(), ctx(), deps, s.onPatch);
    assert.equal(s.get('a').state, 'save_failed');
    assert.equal(s.get('a').error, 'boom');
    assert.equal(s.get('b').state, 'saved');
  });

  it('RETRY after a half-failed save reuses the paper it made instead of skipping it', async () => {
    let failOnce = true;
    const { deps, calls } = fakeDeps({
      async setGrade(a, q, m) {
        if (q === 'q2' && failOnce) { failOnce = false; throw new Error('network'); }
        calls.push(`grade:${a}:${q}:${m}`);
      },
      async startAttempt(_e, studentId) {
        calls.push(`start:${studentId}`);
        // The second time, the paper exists because of THIS batch.
        return { attemptId: 'att-s1', created: calls.filter(c => c.startsWith('start')).length === 1 };
      },
    });
    const s = store([row('a', 's1')]);
    await saveRows('e1', s.all(), ctx(), deps, s.onPatch);
    assert.equal(s.get('a').state, 'save_failed');
    assert.equal(s.get('a').attemptId, 'att-s1');
    assert.deepEqual(s.get('a').savedQuestionIds, ['q1']);

    await saveRows('e1', s.all(), ctx(), deps, s.onPatch);
    assert.equal(s.get('a').state, 'saved', 'the retry must not skip its own paper');
    assert.equal(calls.filter(c => c.startsWith('start')).length, 1, 'start is not called again');
    assert.equal(calls.filter(c => c === 'grade:att-s1:q1:4').length, 1, 'q1 is not written twice');
    assert.ok(calls.includes('grade:att-s1:q2:7'));
  });

  it('a failed submit retries just the submit', async () => {
    let failOnce = true;
    const { deps, calls } = fakeDeps({
      async submit(a) { if (failOnce) { failOnce = false; throw new Error('x'); } calls.push(`submit:${a}`); },
    });
    const s = store([row('a', 's1')]);
    await saveRows('e1', s.all(), ctx(), deps, s.onPatch);
    await saveRows('e1', s.all(), ctx(), deps, s.onPatch);
    assert.equal(s.get('a').state, 'saved');
    assert.equal(calls.filter(c => c.startsWith('grade')).length, 2, 'each mark written once');
    assert.equal(calls.filter(c => c.startsWith('submit')).length, 1);
  });

  it('ignores rows that are not ready: unassigned, failed photos, already saved', async () => {
    const { deps, calls } = fakeDeps();
    const unassigned = { ...row('a', 's1'), studentId: null };
    const failed: ReviewRow = { ...newRow('f'), state: 'failed' };
    const saved: ReviewRow = { ...row('s', 's9'), state: 'saved' };
    const s = store([unassigned, failed, saved]);
    await saveRows('e1', s.all(), ctx(), deps, s.onPatch);
    assert.deepEqual(calls, []);
  });
});

describe('saveRows — the paper a row remembers', () => {
  it('a row that has started a paper is locked to its student: reassigning it does nothing', () => {
    const started: ReviewRow = { ...row('a', 's1'), attemptId: 'att-s1', state: 'save_failed', savedQuestionIds: ['q1'], writtenQuestionIds: ['q1'] };
    assert.equal(isStudentLocked(started), true);
    for (const target of ['s2', null, 's1']) {
      const after = assignStudent(started, target);
      assert.equal(after, started, String(target));
      assert.equal(after.studentId, 's1');
      assert.equal(after.attemptId, 'att-s1');
      assert.deepEqual(after.savedQuestionIds, ['q1']);
      assert.deepEqual(after.writtenQuestionIds, ['q1']);
    }
  });

  it('a row with no paper yet reassigns freely', () => {
    const fresh = row('a', 's1');
    assert.equal(isStudentLocked(fresh), false);
    const after = assignStudent(fresh, 's2');
    assert.equal(after.studentId, 's2');
    assert.equal(after.attemptId, null);
    assert.equal(assignStudent(fresh, null).studentId, null);
  });

  it('a half-failed save cannot be moved to another student; the retry finishes the SAME paper', async () => {
    let failOnce = true;
    const { deps, calls } = fakeDeps({
      async setGrade(a, q, m) {
        if (q === 'q2' && failOnce) { failOnce = false; throw new Error('network'); }
        calls.push(`grade:${a}:${q}:${m}`);
      },
    });
    const s = store([row('a', 's1')]);
    await saveRows('e1', s.all(), ctx(), deps, s.onPatch);
    assert.equal(s.get('a').state, 'save_failed');
    assert.equal(s.get('a').attemptId, 'att-s1');
    assert.deepEqual(s.get('a').savedQuestionIds, ['q1']);

    // The teacher tries to hand the row to s2: s1's paper already holds q1.
    s.onPatch('a', assignStudent(s.get('a'), 's2'));
    assert.equal(s.get('a').studentId, 's1');

    const before = calls.length;
    await saveRows('e1', s.all(), ctx(), deps, s.onPatch);
    assert.deepEqual(calls.slice(before), ['grade:att-s1:q2:7', 'submit:att-s1']);
    assert.equal(calls.filter(c => c.startsWith('start')).length, 1, 'no second startAttempt');
    assert.equal(s.get('a').state, 'saved');
  });

  it('a discarded row is never written', async () => {
    const { deps, calls } = fakeDeps();
    const s = store([discardRow(row('a', 's1')), row('b', 's2')]);
    assert.equal(s.get('a').state, 'discarded');
    await saveRows('e1', s.all(), ctx(), deps, s.onPatch);
    assert.deepEqual(calls, ['start:s2', 'grade:att-s2:q1:4', 'grade:att-s2:q2:7', 'submit:att-s2']);
    assert.equal(s.get('a').state, 'discarded');
  });

  it('a box cleared after its mark was written fails loudly and is never submitted', async () => {
    let failSubmit = true;
    let submits = 0;
    const { deps, calls } = fakeDeps({
      async submit(a) {
        submits++;
        if (failSubmit) { failSubmit = false; throw new Error('network'); }
        calls.push(`submit:${a}`);
      },
    });
    const s = store([row('a', 's1')]);
    await saveRows('e1', s.all(), ctx(), deps, s.onPatch);
    assert.equal(s.get('a').state, 'save_failed');
    assert.deepEqual(s.get('a').writtenQuestionIds, ['q1', 'q2']);

    s.onPatch('a', setMark(s.get('a'), 'q1', ''));
    await saveRows('e1', s.all(), ctx(), deps, s.onPatch);
    assert.equal(s.get('a').state, 'save_failed');
    assert.equal(s.get('a').error, 'cleared_after_write');
    assert.equal(submits, 1, 'the second save never reaches submit');
    assert.equal(calls.filter(c => c === 'grade:att-s1:q1:4').length, 1, 'q1 is not written again');
  });

  it('a blank box that was never written still saves unmarked', async () => {
    const { deps, calls } = fakeDeps();
    const s = store([row('a', 's1', { q2: 7 })]);
    await saveRows('e1', s.all(), ctx(), deps, s.onPatch);
    assert.deepEqual(calls, ['start:s1', 'grade:att-s1:q2:7', 'submit:att-s1']);
    assert.equal(s.get('a').state, 'saved');
  });

  it('a row reaching saveRows with an out-of-range box fails loudly and is never submitted', async () => {
    const { deps, calls } = fakeDeps();
    const s = store([row('a', 's1', { q1: 9, q2: 7 })]);
    await saveRows('e1', s.all(), ctx(), deps, s.onPatch);
    assert.equal(s.get('a').state, 'save_failed');
    assert.equal(s.get('a').error, 'invalid_mark');
    assert.equal(calls.some(c => c.startsWith('grade') || c.startsWith('submit')), false);
  });

  it('a row holding its own half-made paper is retried even though its student has a paper', async () => {
    const { deps, calls } = fakeDeps();
    const s = store([{ ...row('a', 's1'), attemptId: 'att-own', state: 'save_failed' }]);
    await saveRows('e1', s.all(), ctx(['s1']), deps, s.onPatch);
    assert.deepEqual(calls, ['grade:att-own:q1:4', 'grade:att-own:q2:7', 'submit:att-own']);
    assert.equal(s.get('a').state, 'saved');
  });

  it('two rows for one student with no paper of their own: the first saves, the second is skipped without a write', async () => {
    let n = 0;
    const { deps, calls } = fakeDeps({
      async startAttempt(_e, studentId) {
        calls.push(`start:${studentId}`);
        n++;
        return { attemptId: `att-${studentId}-${n}`, created: n === 1 };
      },
    });
    const s = store([row('a', 's1'), row('b', 's1')]);
    await saveRows('e1', s.all(), ctx(), deps, s.onPatch);
    assert.equal(s.get('a').state, 'saved');
    assert.equal(s.get('b').state, 'skipped_existing');
    assert.deepEqual(calls, ['start:s1', 'grade:att-s1-1:q1:4', 'grade:att-s1-1:q2:7', 'submit:att-s1-1', 'start:s1']);
  });
});
