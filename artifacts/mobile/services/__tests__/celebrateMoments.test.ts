// Each of the four moments mounts the shared Celebrate overlay
// (docs/superpowers/specs/2026-10-22-celebrations-design.md). The firing rule
// itself is pinned in celebration.test.ts; these pin that each screen uses it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');

test('the overlay never blocks a tap and respects reduced motion', () => {
  const src = read('components', 'ui', 'Celebrate.tsx');
  assert.match(src, /pointerEvents="none"/);
  assert.match(src, /useReduceMotion\(/);
  assert.match(src, /NATIVE_DRIVER/);
  assert.doesNotMatch(src, /useNativeDriver:\s*(true|false)/, 'pass NATIVE_DRIVER, never a literal');
});

test('an exam handed in during this sitting is celebrated', () => {
  const src = read('app', 'take', '[code].tsx');
  assert.match(src, /<Celebrate\b/);
  assert.match(src, /celebrateHandedIn/);
});

test('a finished game is celebrated, louder for a perfect score', () => {
  const src = read('components', 'publicGames', 'GameShell.tsx');
  assert.match(src, /<Celebrate\b/);
  assert.match(src, /justCompleted\(/);
  assert.match(src, /celebrateGamePerfect/);
  assert.match(read('components', 'publicGames', 'TriviaGame.tsx'), /perfect:/);
  assert.match(read('components', 'publicGames', 'MathDrillGame.tsx'), /perfect:/);
});
