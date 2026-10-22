// Pins the entry stagger used by components/ui/Entrance.tsx
// (docs/superpowers/specs/2026-10-21-visual-language-design.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOTION, entranceDelay } from '../motion.ts';

test('the first card starts at once and each next one a stagger later', () => {
  assert.equal(entranceDelay(0), 0);
  assert.equal(entranceDelay(1), MOTION.staggerMs);
  assert.equal(entranceDelay(3), 3 * MOTION.staggerMs);
});

test('cards past the cap start together, so a long list does not crawl in', () => {
  const last = MOTION.staggerCap * MOTION.staggerMs;
  assert.equal(entranceDelay(MOTION.staggerCap), last);
  assert.equal(entranceDelay(MOTION.staggerCap + 1), last);
  assert.equal(entranceDelay(400), last);
});

test('a bad index starts at once', () => {
  assert.equal(entranceDelay(-2), 0);
  assert.equal(entranceDelay(Number.NaN), 0);
  assert.equal(entranceDelay(Number.POSITIVE_INFINITY), 0);
});

test('the slowest card is in place within half a second', () => {
  assert.ok(MOTION.staggerCap * MOTION.staggerMs + MOTION.enterMs <= 500);
});
