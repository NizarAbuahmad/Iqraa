import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ANSWER_MOTION, STREAK_SHOW_AT, nextStreak, showStreak } from '../publicGames/answerMotion.ts';

test('a streak counts right answers in a row and a wrong one ends it', () => {
  let s = 0;
  for (const correct of [true, true, true, false, true]) s = nextStreak(s, correct);
  assert.equal(s, 1);
  assert.equal(nextStreak(5, false), 0);
  assert.equal(nextStreak(0, true), 1);
});

test('the chip shows from two in a row', () => {
  assert.equal(STREAK_SHOW_AT, 2);
  assert.equal(showStreak(1), false);
  assert.equal(showStreak(2), true);
  assert.equal(showStreak(9), true);
});

test('the shake settles back to rest, and the pop is small and quick', () => {
  assert.equal(ANSWER_MOTION.shake[ANSWER_MOTION.shake.length - 1], 0);
  assert.ok(ANSWER_MOTION.shake.every(v => Math.abs(v) <= 8));
  assert.ok(ANSWER_MOTION.popScale > 1 && ANSWER_MOTION.popScale <= 1.08);
  assert.ok(ANSWER_MOTION.shakeStepMs * ANSWER_MOTION.shake.length <= 400);
});

test('the option animates only when motion is allowed, and the board shows the chip', () => {
  const root = join(import.meta.dirname, '..', '..', 'components', 'publicGames');
  const option = readFileSync(join(root, 'AnswerOption.tsx'), 'utf8');
  assert.match(option, /useReduceMotion\(\)/);
  assert.match(option, /NATIVE_DRIVER/);
  assert.doesNotMatch(option, /fontSize:\s*\d/);
  const board = readFileSync(join(root, 'TriviaGame.tsx'), 'utf8');
  assert.match(board, /<AnswerOption/);
  assert.match(board, /nextStreak\(/);
  assert.match(board, /name="flame"/);
});
