/**
 * Drift check for the generated figure asset map.
 *
 * `bookFigureAssets.ts` is written by `scripts/gen_book_figure_assets.mjs` and
 * is the one file that cannot be derived at runtime — Metro needs literal
 * `require()` calls. So the failure mode is silent: extract new figures, edit
 * the lesson map, forget to regenerate, and those figures are simply absent
 * from the app with nothing to say so.
 *
 * This asserts the map covers exactly the figures a lesson can reach. It reads
 * the generated file as TEXT rather than importing it, because `require()` of
 * a PNG only resolves inside a bundler.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { figuresForLesson, lessonsWithFigures } from '../bookFigures.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GENERATED = readFileSync(path.join(HERE, '../bookFigureAssets.ts'), 'utf8');

/** The `'sourceId/file'` keys the generated map declares. */
function generatedKeys(): string[] {
  return [...GENERATED.matchAll(/^ {2}'([^']+)': require\(/gm)].map(m => m[1]!);
}

describe('bookFigureAssets', () => {
  it('bundles exactly the figures a lesson can reach', () => {
    // "Reachable" is exactly what a lesson can ask for, so ask the lessons.
    const reachable = new Set<string>();
    for (const id of lessonsWithFigures()) {
      for (const f of figuresForLesson(id)) reachable.add(`${f.sourceId}/${f.file}`);
    }
    assert.deepEqual(
      generatedKeys().slice().sort(),
      [...reachable].sort(),
      'the generated asset map is stale — run `node scripts/gen_book_figure_assets.mjs`',
    );
    // A floor, so a join that silently resolves nothing cannot pass as "clean".
    assert.ok(generatedKeys().length > 50, `only ${generatedKeys().length} figures bundled`);
  });
});
