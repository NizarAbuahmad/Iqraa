import test from 'node:test';
import assert from 'node:assert/strict';
import { generationPhase } from '../generationPhase.ts';

/*
  The status block's phase, and the order it decides in. A Cancel leaves
  `cancelled` set; it outranks a failure, so a later refused press (no curriculum
  for this scope, a topic from another subject, a scope that cannot be grounded)
  showed «أُلغي» over its own message until `generate` cleared it first.
*/

test('a run in flight beats a cancel, a cancel beats a failure, a failure beats nothing', () => {
  assert.equal(generationPhase({ loading: true, cancelled: true, failed: true }), 'loading');
  assert.equal(generationPhase({ loading: false, cancelled: true, failed: true }), 'cancelled');
  assert.equal(generationPhase({ loading: false, cancelled: false, failed: true }), 'error');
  assert.equal(generationPhase({ loading: false, cancelled: false, failed: false }), 'idle');
});

test('cancel, then a refused press: the refusal wins once generate clears `cancelled` first', () => {
  const afterCancel = { loading: false, cancelled: true, failed: false };
  assert.equal(generationPhase(afterCancel), 'cancelled');
  // The bug: a refusal sets the error but leaves the cancel, and the cancel is drawn.
  assert.equal(generationPhase({ ...afterCancel, failed: true }), 'cancelled');
  // The fix: `generate` clears `cancelled` at its very start, then the refusal sets the error.
  assert.equal(generationPhase({ ...afterCancel, cancelled: false, failed: true }), 'error');
});

test('a refusal with no generation failure to show is idle (the field shows it, not the status block)', () => {
  assert.equal(generationPhase({ loading: false, cancelled: false, failed: false }), 'idle');
});
