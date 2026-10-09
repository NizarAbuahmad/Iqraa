/**
 * What this guards: an account switch must never let a refresh started for the
 * previous account write that account's tokens over the new one's.
 *
 * Modelled with one in-memory "active slot", the way apiClient.ts and
 * AuthContext.switchAccount use the real one.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { RefreshGate } from '../refreshGate.ts';

function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('RefreshGate', () => {
  it('collapses concurrent refreshes into one', async () => {
    const gate = new RefreshGate<string>();
    let calls = 0;
    const d = deferred<string>();
    const run = () => { calls += 1; return d.promise; };
    const a = gate.refresh(run, async () => 'slot');
    const b = gate.refresh(run, async () => 'slot');
    d.resolve('new');
    assert.deepEqual(await Promise.all([a, b]), ['new', 'new']);
    assert.equal(calls, 1);
  });

  it('a swap waits for the refresh in flight, so the old account is set aside with its newest token', async () => {
    const gate = new RefreshGate<string>();
    let slot = 'A1';
    const network = deferred();
    const refreshing = gate.refresh(async () => {
      await network.promise;
      slot = 'A2';
      return slot;
    }, async () => slot);

    let setAside: string | null = null;
    const switching = gate.swap(async () => {
      setAside = slot;
      slot = 'B1';
    });

    network.resolve();
    await Promise.all([refreshing, switching]);
    assert.equal(setAside, 'A2', 'the leaving account kept its rotated token, not the retired one');
    assert.equal(slot, 'B1', 'the refresh result did not overwrite the new account');
  });

  it('a refresh asked for during a swap does not refresh, and returns the new slot', async () => {
    const gate = new RefreshGate<string>();
    let slot = 'A1';
    const commit = deferred();
    const switching = gate.swap(async () => {
      await commit.promise;
      slot = 'B1';
    });

    let ran = false;
    const refreshing = gate.refresh(async () => { ran = true; slot = 'A2'; return slot; }, async () => slot);
    commit.resolve();
    await switching;
    assert.equal(await refreshing, 'B1');
    assert.equal(ran, false);
    assert.equal(slot, 'B1');
  });

  it('a failed refresh or swap does not wedge the gate', async () => {
    const gate = new RefreshGate<string>();
    await assert.rejects(gate.refresh(() => { throw new Error('sync boom'); }, async () => 'slot'));
    await assert.rejects(gate.swap(async () => { throw new Error('swap boom'); }));
    assert.equal(await gate.refresh(async () => 'ok', async () => 'slot'), 'ok');
  });

  it('a swap still runs when the refresh it waited for failed', async () => {
    const gate = new RefreshGate<string>();
    const network = deferred<string>();
    const refreshing = gate.refresh(() => network.promise, async () => 'slot');
    let swapped = false;
    const switching = gate.swap(async () => { swapped = true; });
    network.reject(new Error('offline'));
    await assert.rejects(refreshing);
    await switching;
    assert.equal(swapped, true);
  });
});
