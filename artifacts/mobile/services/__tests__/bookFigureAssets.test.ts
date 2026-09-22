/**
 * Drift check for the generated figure asset map.
 *
 * `bookFigureAssets.ts` is written by `scripts/gen_book_figure_assets.mjs`, and
 * it is what `bookFigureUri` trusts when it decides a figure exists. So the
 * failure mode is silent: extract new figures, edit the lesson map, forget to
 * regenerate, and those figures are simply absent from the app with nothing to
 * say so. Since the figures moved to R2 there is a second half to that — the
 * uploader walks this same list, so a stale list means a figure is missing
 * from the bucket as well as from the app.
 *
 * This asserts the list covers exactly the figures a lesson can reach. It
 * reads the generated file as TEXT rather than importing it, so the check
 * stays a plain string comparison with no module graph to satisfy.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { figuresForLesson, lessonsWithFigures } from '../bookFigures.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GENERATED = readFileSync(path.join(HERE, '../bookFigureAssets.ts'), 'utf8');

/** The `'sourceId/file'` keys the generated list declares. */
function generatedKeys(): string[] {
  return [...GENERATED.matchAll(/^ {2}'([^']+)',$/gm)].map(m => m[1]!);
}

describe('bookFigureAssets', () => {
  it('lists exactly the figures a lesson can reach', () => {
    // "Reachable" is exactly what a lesson can ask for, so ask the lessons.
    const reachable = new Set<string>();
    for (const id of lessonsWithFigures()) {
      for (const f of figuresForLesson(id)) reachable.add(`${f.sourceId}/${f.file}`);
    }
    assert.deepEqual(
      generatedKeys().slice().sort(),
      [...reachable].sort(),
      'the generated figure list is stale — run `node scripts/gen_book_figure_assets.mjs`',
    );
    // A floor, so a join that silently resolves nothing cannot pass as "clean".
    assert.ok(generatedKeys().length > 50, `only ${generatedKeys().length} figures listed`);
  });
});
