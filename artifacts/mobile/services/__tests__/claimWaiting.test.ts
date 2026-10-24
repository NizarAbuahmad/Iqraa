/**
 * What the mandatory claim screen shows: the code form, or — while the teacher
 * has not answered — a waiting card. When a request that was waiting is gone
 * and no link appeared, the teacher said no, and the form says so.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { claimScreenState } from '../claimWaiting.ts';

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

  it('reads an approval as a decline unless the caller checked links first', () => {
    // An approved request is gone from `pending` exactly like a declined one, so
    // ([], true) is "declined" by design. hooks/useClaimWaiting.ts therefore reads
    // `links` BEFORE `pending` and lets the account in when there is a link; a
    // caller that skips that step would show «your teacher did not approve» to a
    // student whose teacher just said yes.
    assert.equal(claimScreenState([], true).declined, true);
    assert.equal(claimScreenState([], true).mode, 'form');
  });
});
