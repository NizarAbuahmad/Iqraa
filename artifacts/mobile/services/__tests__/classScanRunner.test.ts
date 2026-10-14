import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scanAll, type PhotoOutcome } from '../classScanRunner.ts';

const noWait = { sleep: async () => {}, backoffMs: () => 0 };

function collect<R>() {
  const outcomes = new Map<number, PhotoOutcome<R>>();
  return { outcomes, on: (i: number, o: PhotoOutcome<R>) => void outcomes.set(i, o) };
}

describe('scanAll', () => {
  it('reads every photo and never has more than three in flight', async () => {
    let inFlight = 0;
    let peak = 0;
    const { outcomes, on } = collect<number>();
    const res = await scanAll(10, async i => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise(r => setTimeout(r, 5));
      inFlight--;
      return i * 2;
    }, on, noWait);
    assert.equal(peak, 3);
    assert.equal(res.stopped, false);
    assert.equal(outcomes.size, 10);
    for (let i = 0; i < 10; i++) assert.deepEqual(outcomes.get(i), { state: 'read', result: i * 2 });
  });

  it('one bad photo costs one row, not the batch', async () => {
    const { outcomes, on } = collect<string>();
    await scanAll(5, async i => {
      if (i === 2) throw { status: 502, code: 'scan_unavailable' };
      return 'ok';
    }, on, noWait);
    assert.equal(outcomes.get(2)!.state, 'failed');
    assert.deepEqual([0, 1, 3, 4].map(i => outcomes.get(i)!.state), ['read', 'read', 'read', 'read']);
  });

  it('stops on a spent allowance, keeps what was read, and marks the rest not_run', async () => {
    const { outcomes, on } = collect<number>();
    const res = await scanAll(10, async i => {
      if (i === 4) throw { status: 429, code: 'user_quota_exceeded' };
      return i;
    }, on, { ...noWait, concurrency: 1 });
    assert.equal(res.stopped, true);
    assert.equal(outcomes.size, 10, 'every photo ends in exactly one outcome');
    assert.deepEqual([0, 1, 2, 3].map(i => outcomes.get(i)!.state), ['read', 'read', 'read', 'read']);
    assert.equal(outcomes.get(4)!.state, 'failed');
    for (let i = 5; i < 10; i++) assert.equal(outcomes.get(i)!.state, 'not_run');
  });

  it('retries a rate limit after a pause and then succeeds', async () => {
    const slept: number[] = [];
    const tries = new Map<number, number>();
    const { outcomes, on } = collect<string>();
    await scanAll(2, async i => {
      const n = (tries.get(i) ?? 0) + 1;
      tries.set(i, n);
      if (i === 0 && n < 3) throw { status: 429, code: 'rate_limited' };
      return 'ok';
    }, on, { sleep: async ms => void slept.push(ms), backoffMs: a => a * 1000 });
    assert.deepEqual(outcomes.get(0), { state: 'read', result: 'ok' });
    assert.equal(tries.get(0), 3);
    assert.deepEqual(slept, [1000, 2000]);
  });

  it('gives up after the retries and reports the photo as failed — without stopping the batch', async () => {
    const { outcomes, on } = collect<string>();
    const res = await scanAll(3, async i => {
      if (i === 1) throw { status: 429, code: 'rate_limited' };
      return 'ok';
    }, on, { ...noWait, maxRetries: 2 });
    assert.equal(res.stopped, false);
    assert.equal(outcomes.get(1)!.state, 'failed');
    assert.equal(outcomes.get(2)!.state, 'read');
  });

  it('reports a started photo so the table can show it reading', async () => {
    const started: number[] = [];
    await scanAll(3, async () => 'ok', () => {}, { ...noWait, concurrency: 1, onStart: i => void started.push(i) });
    assert.deepEqual(started, [0, 1, 2]);
  });

  it('handles an empty batch', async () => {
    const res = await scanAll(0, async () => 'x', () => assert.fail('no outcome expected'), noWait);
    assert.equal(res.stopped, false);
  });

  it('a throwing onOutcome cannot lose or duplicate a photo outcome', async () => {
    const boom = new Error('ui bug');
    const calls = new Map<number, number>();
    let scanned = 0;
    await assert.rejects(
      scanAll(4, async i => {
        scanned++;
        return i;
      }, (i, o) => {
        calls.set(i, (calls.get(i) ?? 0) + 1);
        if (i === 1 && o.state === 'read') throw boom;
      }, { ...noWait, concurrency: 1 }),
      err => err === boom,
    );
    assert.equal(scanned, 4, 'the other photos were still scanned');
    for (let i = 0; i < 4; i++) assert.equal(calls.get(i), 1, `index ${i} got exactly one onOutcome call`);
  });

  it('a quota error on the first photo is never retried or slept on, and stops the batch', async () => {
    const tries = new Map<number, number>();
    const slept: number[] = [];
    const { outcomes, on } = collect<string>();
    const res = await scanAll(3, async i => {
      tries.set(i, (tries.get(i) ?? 0) + 1);
      if (i === 0) throw { status: 429, code: 'user_quota_exceeded' };
      return 'ok';
    }, on, { concurrency: 1, backoffMs: () => 0, sleep: async ms => void slept.push(ms) });
    assert.equal(tries.get(0), 1, 'scanned exactly once');
    assert.deepEqual(slept, [], 'no pause');
    assert.equal(res.stopped, true);
    assert.equal(outcomes.get(0)!.state, 'failed');
    assert.equal(outcomes.get(1)!.state, 'not_run');
    assert.equal(outcomes.get(2)!.state, 'not_run');
  });
});
