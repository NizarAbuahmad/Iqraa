// Pins how the tour finds the element a step points at: several screens (and,
// on desktop, a hidden tab bar AND a sidebar) can register the same id, and only
// one of them is actually on screen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasTarget, measureTarget, registerTarget, revealTarget, type Rect } from '../tourRegistry.ts';

const rect = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });
const at = (r: Rect | null) => ({ measure: async () => r });

test('nothing registered: no target and no rect', async () => {
  assert.equal(hasTarget('nope'), false);
  assert.equal(await measureTarget('nope'), null);
});

test('a registered target is found and measured, and gone once it unregisters', async () => {
  const off = registerTarget('a', at(rect(10, 20, 30, 40)));
  assert.equal(hasTarget('a'), true);
  assert.deepEqual(await measureTarget('a'), rect(10, 20, 30, 40));
  off();
  assert.equal(hasTarget('a'), false);
  assert.equal(await measureTarget('a'), null);
});

test('a hidden registrant (0×0, like the desktop tab bar) is skipped for the visible one', async () => {
  const offs = [registerTarget('tab', at(rect(0, 0, 0, 0))), registerTarget('tab', at(rect(5, 6, 70, 80)))];
  assert.deepEqual(await measureTarget('tab'), rect(5, 6, 70, 80));
  offs.forEach(off => off());
});

test('when every registrant is hidden or unmeasurable, there is no rect to ring', async () => {
  const offs = [registerTarget('t', at(rect(0, 0, 0, 0))), registerTarget('t', at(null))];
  assert.equal(await measureTarget('t'), null);
  offs.forEach(off => off());
});

test('the first visible registrant wins, in the order they registered', async () => {
  const offs = [registerTarget('o', at(rect(1, 1, 10, 10))), registerTarget('o', at(rect(2, 2, 20, 20)))];
  assert.deepEqual(await measureTarget('o'), rect(1, 1, 10, 10));
  offs.forEach(off => off());
});

test('one registrant leaving does not take the others with it', async () => {
  const offA = registerTarget('k', at(rect(1, 1, 5, 5)));
  const offB = registerTarget('k', at(rect(2, 2, 6, 6)));
  offA();
  assert.deepEqual(await measureTarget('k'), rect(2, 2, 6, 6));
  offA(); // a second call is harmless
  assert.equal(hasTarget('k'), true);
  offB();
  assert.equal(hasTarget('k'), false);
});

test('a measurement that throws is treated as not visible, not as a crash', async () => {
  const offs = [
    registerTarget('x', { measure: async () => { throw new Error('unmounted'); } }),
    registerTarget('x', at(rect(3, 3, 9, 9))),
  ];
  assert.deepEqual(await measureTarget('x'), rect(3, 3, 9, 9));
  offs.forEach(off => off());
});

test('reveal runs for every registrant of the id (a scroll view bringing its target into view)', async () => {
  const calls: string[] = [];
  const offs = [
    registerTarget('r', { measure: async () => null, reveal: () => { calls.push('one'); } }),
    registerTarget('r', { measure: async () => null }),
    registerTarget('r', { measure: async () => null, reveal: async () => { calls.push('two'); } }),
  ];
  await revealTarget('r');
  assert.deepEqual(calls, ['one', 'two']);
  await revealTarget('missing'); // nothing to reveal is fine
  offs.forEach(off => off());
});
