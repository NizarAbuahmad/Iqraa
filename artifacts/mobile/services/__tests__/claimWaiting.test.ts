/**
 * What the mandatory claim screen shows: the code form, or — while the teacher
 * has not answered — a waiting card. When a request that was waiting is gone
 * and no link appeared, the teacher said no, and the form says so.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { claimScreenState, interpretClaimRead } from '../claimWaiting.ts';

describe('claimScreenState', () => {
  it('shows the form, undeclined, for an account that never asked', () => {
    assert.deepEqual(claimScreenState([], false), { mode: 'form', studentName: '', declined: false });
  });

  it('shows the waiting card with the name that was picked', () => {
    assert.deepEqual(
      claimScreenState([{ studentId: 's1', displayName: 'خالد' }], false),
      { mode: 'waiting', studentName: 'خالد', declined: false },
    );
  });

  it('says it was declined when a waiting request disappears without a link', () => {
    assert.deepEqual(claimScreenState([], true), { mode: 'form', studentName: '', declined: true });
  });

  it('reads ([], true) as declined by design, which is why links are decided first (interpretClaimRead)', () => {
    assert.equal(claimScreenState([], true).declined, true);
    assert.equal(claimScreenState([], true).mode, 'form');
  });
});

describe('interpretClaimRead', () => {
  const link = { studentId: 's1', displayName: 'خالد', gradeId: null };
  const held = { studentId: 's1', displayName: 'خالد' };

  it('a link with nothing pending after waiting is an approval, never a decline', () => {
    assert.deepEqual(interpretClaimRead([link], [], { wasWaiting: true, adoptLinks: true }), { kind: 'linked' });
  });

  it('a link wins over a pending request too', () => {
    assert.deepEqual(interpretClaimRead([link], [held], { wasWaiting: true, adoptLinks: true }), { kind: 'linked' });
  });

  it('no link and nothing pending after a request was waiting is a decline', () => {
    const out = interpretClaimRead([], [], { wasWaiting: true, adoptLinks: true });
    assert.deepEqual(out, { kind: 'state', pending: [], wasWaiting: true });
    assert.equal(out.kind === 'state' && claimScreenState(out.pending, out.wasWaiting).declined, true);
  });

  it('no link and nothing pending for an account that never asked is a plain form', () => {
    const out = interpretClaimRead([], [], { wasWaiting: false, adoptLinks: true });
    assert.deepEqual(out, { kind: 'state', pending: [], wasWaiting: false });
    assert.equal(out.kind === 'state' && claimScreenState(out.pending, out.wasWaiting).declined, false);
  });

  it('a pending request is waiting, and remembered as having waited', () => {
    assert.deepEqual(
      interpretClaimRead([], [held], { wasWaiting: false, adoptLinks: true }),
      { kind: 'state', pending: [held], wasWaiting: true },
    );
  });

  it('a link on arrival is ignored when the caller does not adopt links (join-class on mount)', () => {
    assert.deepEqual(interpretClaimRead([link], [held], { wasWaiting: false, adoptLinks: false }), { kind: 'ignore' });
    assert.deepEqual(interpretClaimRead([link], [], { wasWaiting: false, adoptLinks: false }), { kind: 'ignore' });
  });

  it('does not alias the pending list it was given', () => {
    const list = [held];
    const out = interpretClaimRead([], list, { wasWaiting: false, adoptLinks: true });
    assert.ok(out.kind === 'state' && out.pending !== list);
  });
});
