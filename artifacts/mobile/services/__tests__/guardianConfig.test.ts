import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { fetchGuardianConfig, resetGuardianConfigCache } from '../guardianConfig.ts';

describe('fetchGuardianConfig', () => {
  beforeEach(() => resetGuardianConfigCache());

  it('returns what the server says and asks only once', async () => {
    let n = 0;
    const load = async () => { n += 1; return { enabled: true }; };
    assert.deepEqual(await fetchGuardianConfig(load), { enabled: true });
    assert.deepEqual(await fetchGuardianConfig(load), { enabled: true });
    assert.equal(n, 1);
  });

  it('fails off: an error answers enabled:false with failed:true, and is not cached', async () => {
    const bad = async () => { throw new Error('offline'); };
    assert.deepEqual(await fetchGuardianConfig(bad, [0]), { enabled: false, failed: true });
    assert.deepEqual(await fetchGuardianConfig(async () => ({ enabled: true })), { enabled: true });
  });

  it('only a boolean true switches it on', async () => {
    assert.deepEqual(await fetchGuardianConfig(async () => ({ enabled: 'yes' as any })), { enabled: false });
  });

  it('a call that gives up returns what a concurrent call cached meanwhile', async () => {
    let n = 0;
    const alwaysBad = async () => { n += 1; throw new Error('offline'); };
    const first = fetchGuardianConfig(alwaysBad, [20]);
    assert.deepEqual(await fetchGuardianConfig(async () => ({ enabled: true })), { enabled: true });
    assert.deepEqual(await first, { enabled: true });
    assert.equal(n, 2);
  });

  it('retries on the delays it is given before giving up', async () => {
    let n = 0;
    const flaky = async () => { n += 1; if (n < 3) throw new Error('x'); return { enabled: true }; };
    assert.deepEqual(await fetchGuardianConfig(flaky, [0, 0]), { enabled: true });
    assert.equal(n, 3);
  });
});
