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
  assert.match(src, /importantForAccessibility="no-hide-descendants"/, 'the message is announced, so the overlay is hidden from the tree');
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
  assert.match(src, /showBadge=/, 'the shell has its own heading, so only a perfect score shows the badge');
  assert.match(read('components', 'publicGames', 'TriviaGame.tsx'), /perfect:/);
  assert.match(read('components', 'publicGames', 'MathDrillGame.tsx'), /perfect:/);
});

test('ticking off the last homework is celebrated, after the save succeeds', () => {
  const src = read('app', '(tabs)', 'school.tsx');
  assert.match(src, /<Celebrate\b/);
  assert.match(src, /allTrackedDone\(/);
  assert.match(src, /celebrateHomeworkAll/);
});

test('a prep checklist reaching all ready is celebrated, on the phone and on desktop', () => {
  const hook = read('hooks', 'useTodayLesson.ts');
  assert.match(hook, /justCompleted\(/, 'the hook does not decide the crossing with justCompleted');
  assert.match(hook, /prepJustReady/);
  for (const f of [['components', 'today', 'PhoneToday.tsx'], ['app', '(tabs)', 'index.tsx']]) {
    const src = read(...f);
    assert.match(src, /<Celebrate\b/, `${f.join('/')} does not mount Celebrate`);
    assert.match(src, /celebratePrepReady/, `${f.join('/')} does not say «الدرس جاهز»`);
  }
});
