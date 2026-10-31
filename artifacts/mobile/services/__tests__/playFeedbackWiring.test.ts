import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');

test('the board gives feedback on every answer and asks the shell for the toggle', () => {
  const board = read('components', 'publicGames', 'TriviaGame.tsx');
  assert.match(board, /answerFeedback\(optionId === question\.correctId\)/);
  assert.match(board, /showSoundToggle/);
});

test('the shell draws a mute button that declares its state with aria-pressed', () => {
  const shell = read('components', 'publicGames', 'GameShell.tsx');
  assert.match(shell, /showSoundToggle\?: boolean/);
  assert.match(shell, /aria-pressed=\{!soundOn\}/);
  assert.match(shell, /volume-high-outline/);
  assert.match(shell, /volume-mute-outline/);
  assert.doesNotMatch(shell, /accessibilityState/);
});

test('the wrong cue is registered and the feedback service honours the mute', () => {
  assert.match(read('services', 'gameSounds.ts'), /'wrong'/);
  assert.match(read('services', 'gameSounds.ts'), /wrong\.wav/);
  const fb = read('services', 'playFeedback.ts');
  assert.match(fb, /if \(!soundOn\) return/);
  assert.match(fb, /Platform\.OS !== 'web'/);
});
