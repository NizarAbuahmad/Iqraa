import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { noteGuardianForbidden } from '../guardianForbidden.ts';

const GUARDIAN = JSON.stringify({ code: 'guardian_approval_required', error: 'x' });

/** The 403 handler is fire and forget; let its promise chain settle. */
const settle = () => new Promise<void>(resolve => setTimeout(resolve, 0));

function counter() {
  let n = 0;
  return { fn: () => { n += 1; }, get count() { return n; } };
}

describe('noteGuardianForbidden', () => {
  it('fires once for a 403 carrying guardian_approval_required', async () => {
    const c = counter();
    noteGuardianForbidden(new Response(GUARDIAN, { status: 403 }), c.fn);
    await settle();
    assert.equal(c.count, 1);
  });

  it('does not fire for another 403 code', async () => {
    const c = counter();
    noteGuardianForbidden(new Response(JSON.stringify({ code: 'forbidden' }), { status: 403 }), c.fn);
    await settle();
    assert.equal(c.count, 0);
  });

  it('does not fire for a 200 or a 401, even with the guardian body', async () => {
    const c = counter();
    noteGuardianForbidden(new Response(GUARDIAN, { status: 200 }), c.fn);
    noteGuardianForbidden(new Response(GUARDIAN, { status: 401 }), c.fn);
    await settle();
    assert.equal(c.count, 0);
  });

  it('ignores a non-JSON 403 body', async () => {
    const c = counter();
    noteGuardianForbidden(new Response('<html>Forbidden</html>', { status: 403 }), c.fn);
    noteGuardianForbidden(new Response('', { status: 403 }), c.fn);
    await settle();
    assert.equal(c.count, 0);
  });

  it('does nothing, and never clones, when no callback is registered', async () => {
    let cloned = 0;
    const res = { status: 403, clone: () => { cloned += 1; return { text: async () => GUARDIAN }; } };
    noteGuardianForbidden(res, null);
    await settle();
    assert.equal(cloned, 0);
  });

  it('swallows a clone() that throws (the Expo native transport) and fires nothing', async () => {
    const c = counter();
    const res = { status: 403, clone: () => { throw new Error('Not implemented'); } };
    assert.doesNotThrow(() => noteGuardianForbidden(res, c.fn));
    await settle();
    assert.equal(c.count, 0);
  });

  it('swallows a body read that rejects', async () => {
    const c = counter();
    const res = { status: 403, clone: () => ({ text: () => Promise.reject(new Error('stream closed')) }) };
    assert.doesNotThrow(() => noteGuardianForbidden(res, c.fn));
    await settle();
    assert.equal(c.count, 0);
  });

  it('leaves the original body readable for the caller', async () => {
    const c = counter();
    const res = new Response(GUARDIAN, { status: 403 });
    noteGuardianForbidden(res, c.fn);
    assert.equal(await res.text(), GUARDIAN);
    await settle();
    assert.equal(c.count, 1);
  });
});
