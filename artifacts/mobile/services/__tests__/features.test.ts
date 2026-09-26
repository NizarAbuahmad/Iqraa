/**
 * A failed feature check hides the role picker and makes every new account a
 * teacher, so fetchFeatures retries before failing closed.
 */
import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { fetchFeatures, resetFeatureCache } from '../features.ts';

const flaky = (failures: number) => {
  let calls = 0;
  const load = async () => {
    calls += 1;
    if (calls <= failures) throw new Error('network');
    return { studentAccounts: true };
  };
  return { load, calls: () => calls };
};

describe('fetchFeatures', () => {
  beforeEach(() => resetFeatureCache());

  it('recovers from transient failures', async () => {
    const f = flaky(2);
    assert.deepEqual(await fetchFeatures(f.load, [0, 0]), { studentAccounts: true });
    assert.equal(f.calls(), 3);
  });

  it('fails closed once retries run out, and caches nothing', async () => {
    const f = flaky(10);
    assert.deepEqual(await fetchFeatures(f.load, [0, 0]), { studentAccounts: false });
    assert.equal(f.calls(), 3);
    const ok = flaky(0);
    assert.deepEqual(await fetchFeatures(ok.load, [0, 0]), { studentAccounts: true });
  });

  it('answers from the cache without loading again', async () => {
    await fetchFeatures(flaky(0).load, []);
    const f = flaky(0);
    await fetchFeatures(f.load, []);
    assert.equal(f.calls(), 0);
  });
});
