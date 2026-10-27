import test from 'node:test';
import assert from 'node:assert/strict';
import { runOptions } from '../runOptions.ts';

/*
  Retry after a failed «ثلاثة مستويات» press re-ran as a single paper: the Retry
  button passed its press event to `generate` as the options, so `levels` was lost.
*/

test('the options a run was asked for are kept exactly', () => {
  assert.deepEqual(runOptions({ levels: true }), { regenerate: false, levels: true });
  assert.deepEqual(runOptions({ regenerate: true }), { regenerate: true, levels: false });
  assert.deepEqual(runOptions({ regenerate: true, levels: true }), { regenerate: true, levels: true });
  assert.deepEqual(runOptions(undefined), { regenerate: false, levels: false });
});

test('a retry carries the levels of the run it repeats: options stored, then passed back, are the same', () => {
  const lastRun = runOptions({ levels: true });
  const retry = runOptions(lastRun);
  assert.deepEqual(retry, lastRun);
  assert.equal(retry.levels, true);
  // Repeated again, still the same.
  assert.deepEqual(runOptions(runOptions(retry)), lastRun);
});

test('a press event, or anything that is not literally true, never switches a mode on', () => {
  const pressEvent = { nativeEvent: {}, target: 1, type: 'press', levels: undefined };
  assert.deepEqual(runOptions(pressEvent), { regenerate: false, levels: false });
  assert.deepEqual(runOptions({ levels: 'true', regenerate: 1 }), { regenerate: false, levels: false });
  assert.deepEqual(runOptions(null), { regenerate: false, levels: false });
  assert.deepEqual(runOptions('levels'), { regenerate: false, levels: false });
});
