// Pins when a celebration fires and how its confetti is laid out
// (docs/superpowers/specs/2026-10-22-celebrations-design.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFETTI_COLORS, confettiPieces, justCompleted, prepCrossing } from '../celebration.ts';
import { CORNERS, CORNER_IDS } from '../../constants/corners.ts';

test('fires on the crossing from not-done to done, for the same subject', () => {
  assert.equal(justCompleted({ key: 'lesson-a', complete: false }, { key: 'lesson-a', complete: true }), true);
});

test('never on the first measurement: opening a screen that is already complete is not a moment', () => {
  assert.equal(justCompleted(null, { key: 'lesson-a', complete: true }), false);
});

test('never when the subject changed: switching to a lesson that is already complete is not a moment', () => {
  assert.equal(justCompleted({ key: 'lesson-a', complete: false }, { key: 'lesson-b', complete: true }), false);
});

test('never while it stays complete, and never on the way back down', () => {
  assert.equal(justCompleted({ key: 'a', complete: true }, { key: 'a', complete: true }), false);
  assert.equal(justCompleted({ key: 'a', complete: true }, { key: 'a', complete: false }), false);
  assert.equal(justCompleted({ key: 'a', complete: false }, { key: 'a', complete: false }), false);
});

// «الدرس جاهز»: the hook feeds prepCrossing the latest read and keeps `nextPrev` as the baseline.
const read = (key: string, complete: boolean, over: Partial<{ authoritative: boolean; skipsReady: boolean }> = {}) =>
  ({ authoritative: true, skipsReady: true, key, complete, ...over });

test('prep: opening Today already at 5 of 5 is not a moment, and 4 to 5 afterwards is', () => {
  const first = prepCrossing(null, read('lesson-a', true));
  assert.equal(first.fire, false);
  assert.deepEqual(first.nextPrev, { key: 'lesson-a', complete: true });
  // 4/5 -> 5/5 on the same lesson
  const four = prepCrossing(null, read('lesson-a', false));
  assert.equal(four.fire, false);
  const five = prepCrossing(four.nextPrev, read('lesson-a', true));
  assert.equal(five.fire, true);
  assert.deepEqual(five.nextPrev, { key: 'lesson-a', complete: true });
});

test('prep: a change of lesson is never a crossing, but becomes the new baseline', () => {
  const r = prepCrossing({ key: 'lesson-a', complete: false }, read('lesson-b', true));
  assert.equal(r.fire, false);
  assert.deepEqual(r.nextPrev, { key: 'lesson-b', complete: true });
});

test('prep: a degraded read never fires and drops the baseline, so the next good read at 5 of 5 is only a baseline', () => {
  // 4/5 on screen, then the read fails and the board falls back to the device list (0/5).
  const degraded = prepCrossing({ key: 'lesson-a', complete: false }, read('lesson-a', false, { authoritative: false }));
  assert.equal(degraded.fire, false);
  assert.equal(degraded.nextPrev, null);
  // A degraded read that happens to look complete must not fire either.
  const degradedFull = prepCrossing({ key: 'lesson-a', complete: false }, read('lesson-a', true, { authoritative: false }));
  assert.equal(degradedFull.fire, false);
  assert.equal(degradedFull.nextPrev, null);
  // The next good read finds 5/5: opening a finished board, not a moment.
  const good = prepCrossing(degraded.nextPrev, read('lesson-a', true));
  assert.equal(good.fire, false);
  assert.deepEqual(good.nextPrev, { key: 'lesson-a', complete: true });
});

test('prep: skips read for another lesson judge nothing and leave the baseline as it was', () => {
  const prev = { key: 'lesson-a', complete: false };
  const r = prepCrossing(prev, read('lesson-b', true, { skipsReady: false }));
  assert.equal(r.fire, false);
  assert.equal(r.nextPrev, prev);
  assert.equal(prepCrossing(null, read('lesson-b', true, { skipsReady: false })).nextPrev, null);
});

test('the same seed lays out the same confetti; another seed does not', () => {
  assert.deepEqual(confettiPieces(24, 7), confettiPieces(24, 7));
  assert.notDeepEqual(confettiPieces(24, 7), confettiPieces(24, 8));
});

test('pieces stay on screen, start within the first third of a second, and come in the asked number', () => {
  const pieces = confettiPieces(24, 3);
  assert.equal(pieces.length, 24);
  for (const p of pieces) {
    assert.ok(p.x >= 0 && p.x <= 1, `x ${p.x}`);
    assert.ok(p.delay >= 0 && p.delay <= 300, `delay ${p.delay}`);
    assert.ok(Math.abs(p.drift) <= 60, `drift ${p.drift}`);
    assert.ok(p.size >= 6 && p.size <= 12, `size ${p.size}`);
    assert.ok(CONFETTI_COLORS.includes(p.color), `color ${p.color}`);
  }
});

test('the confetti wears the brand teal and every corner, and never amber, which means "now"', () => {
  assert.ok(CONFETTI_COLORS.includes('#006D65'));
  for (const id of CORNER_IDS) assert.ok(CONFETTI_COLORS.includes(CORNERS[id].light.primary), `${id} missing`);
  assert.ok(!CONFETTI_COLORS.includes('#B45309'));
});
