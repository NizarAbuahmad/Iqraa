import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', '..', 'components', 'publicGames');
const board = readFileSync(join(root, 'TriviaGame.tsx'), 'utf8');
const shell = readFileSync(join(root, 'GameShell.tsx'), 'utf8');

test('a full round records the best, a retry round does not', () => {
  assert.match(board, /recordBest\(playStore, bestGameKey/);
  assert.match(board, /if \(!gameOver \|\| retryQuestions\) return/);
});

test('missed questions are collected and offered back through the shell', () => {
  assert.match(board, /setMissed\(/);
  assert.match(board, /secondaryAction=/);
  assert.match(shell, /secondaryAction\?:/);
  assert.match(shell, /secondaryAction\.onPress/);
});

test('a retry round is never reported and never shows the caller\'s send status', () => {
  assert.match(board, /onFinished=\{retryQuestions \? undefined : onFinished\}/);
  assert.match(board, /\{retryQuestions \? null : footer\}/);
});

test('a lesson game keeps its best per lesson', () => {
  assert.match(board, /analytics\?\.lessonId \? `\$\{titleKey\}:\$\{analytics\.lessonId\}` : titleKey/);
});

test('a retry round is practice: it never earns the full-mark celebration', () => {
  assert.match(board, /perfect: !retryQuestions && score === questions\.length/);
});
