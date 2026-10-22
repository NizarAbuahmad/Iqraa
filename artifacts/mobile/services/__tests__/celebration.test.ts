// Pins when a celebration fires and how its confetti is laid out
// (docs/superpowers/specs/2026-10-22-celebrations-design.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFETTI_COLORS, confettiPieces, justCompleted } from '../celebration.ts';
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
