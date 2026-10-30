// The game-over panel is shared by every GameShell game. It once was a fixed centred View, which on a
// 320x568 phone cut off the trophy and the teacher signup card with no way to reach them. It scrolls
// now, and still centres when it fits: that needs `flexGrow` (a `flex: 1` content container shrinks to the
// viewport and never scrolls).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const shell = readFileSync(join(import.meta.dirname, '..', '..', 'components', 'publicGames', 'GameShell.tsx'), 'utf8');

test('the game-over panel is a ScrollView whose content container is styles.overlay', () => {
  assert.match(shell, /import \{[^}]*\bScrollView\b[^}]*\} from 'react-native'/);
  assert.match(shell, /<ScrollView[^>]*contentContainerStyle=\{styles\.overlay\}/s);
  assert.doesNotMatch(shell, /<View style=\{styles\.overlay\}/);
});

test('the overlay style grows, it does not use flex: 1', () => {
  const overlay = shell.match(/overlay:\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(overlay, /flexGrow:\s*1/);
  assert.doesNotMatch(overlay, /\bflex:\s*1/);
});
