// A public game must lead back to the games hub from its header arrow AND from
// its game-over screen (which used to offer only «play again» and sign-up, so a
// player who finished a round had no visible way out). A game opened from a
// lesson passes `onBack` and goes back there instead of to the hub. `replace`
// alone left the hub twice in the history, so the hub goes through `goToGames`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');

test('GameShell: arrow and game-over button both leave through onBack ?? goToGames', () => {
  const src = read('components', 'publicGames', 'GameShell.tsx');
  const exits = src.match(/onPress=\{onBack \?\? goToGames\}/g) ?? [];
  assert.equal(exits.length, 2, 'the header arrow and the game-over button share one exit');
  assert.ok(src.includes("t(onBack ? 'back' : 'playBackToMenu')"), 'the label says where it goes');
  assert.ok(!src.includes("router.replace('/play'"), 'no private replace to /play: it doubles the hub in history');
});

test('goToGames pops to the hub when there is history and replaces when there is none', () => {
  const src = read('services', 'navigation.ts');
  const body = src.slice(src.indexOf('export function goToGames'));
  assert.match(body, /canGoBack\(\)\) router\.dismissTo\('\/play' as any\)/);
  assert.match(body, /else router\.replace\('\/play' as any\)/);
});
