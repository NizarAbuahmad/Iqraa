/**
 * Saving a class scan must never overwrite a paper it did not create, and a
 * retry must never skip a paper it did.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { saveRows, type SaveDeps } from '../classScanSave.ts';
import { newRow, rowFromScan, type ReviewContext, type ReviewRow } from '../classScanReview.ts';
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
