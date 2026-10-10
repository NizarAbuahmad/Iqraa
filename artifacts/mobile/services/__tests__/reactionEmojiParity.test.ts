/**
 * What this guards: the emoji list lives in two places — the API (which rejects
 * anything else) and the app (which draws the picker). They are separate
 * packages, so nothing but this test notices when one moves without the other.
 * The result of drift is not a crash: a new app emoji would just be a 400 in a
 * teacher's hands.
 *
 * Reads both files as text instead of importing the API module, so the app's
 * typecheck never has to follow an import into another package.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

const declaration = (file: string): string[] => {
  const src = readFileSync(file, 'utf8');
  const m = src.match(/export const REACTION_EMOJI = (\[[^\]]*\])/);
  assert.ok(m, `no single-line "export const REACTION_EMOJI = [...]" in ${file}`);
  // Quote style differs between the two packages; the values must not.
  return JSON.parse(m![1]!.replace(/'/g, '"')) as string[];
};

describe('REACTION_EMOJI parity', () => {
  it('is the same six emoji, in the same order, in the API and the app', () => {
    const api = declaration(resolve(HERE, '../../../api-server/src/lib/messageReactions.ts'));
    const app = declaration(resolve(HERE, '../messageReactions.ts'));
    assert.equal(api.length, 6);
    assert.deepEqual(app, api);
    assert.equal(app[1], '❤️', 'the heart must be U+2764 U+FE0F');
  });
});
