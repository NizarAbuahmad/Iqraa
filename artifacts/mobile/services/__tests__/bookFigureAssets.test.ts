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
    const reachable = new Set<string>();
    for (const id of lessonsWithFigures()) {
      for (const f of figuresForLesson(id)) reachable.add(`${f.sourceId}/${f.file}`);
    }
    assert.deepEqual(
      generatedKeys().sort(),
      [...reachable].sort(),
      'stale — run `node scripts/gen_book_figure_assets.mjs`',
    );
  });

  it('agrees with its own declared count', () => {
    const declared = Number(/BOOK_FIGURE_COUNT = (\d+)/.exec(GENERATED)?.[1]);
    assert.equal(declared, generatedKeys().length);
  });

  it('requires each PNG by a path that exists on disk', () => {
    // A path typo would only surface as a bundler failure on deploy.
    for (const [, rel] of GENERATED.matchAll(/require\('([^']+)'\)/g)) {
      const abs = path.resolve(HERE, '..', rel!);
      assert.ok(readFileSync(abs).length > 0, `${rel} is missing or empty`);
    }
  });

  it('bundles nothing unreachable — no chemistry, no unmapped figure', () => {
    // 63 figures were extracted; only the mapped ones are worth downloading.
    assert.ok(generatedKeys().every(k => !k.startsWith('chem-')));
    assert.equal(generatedKeys().length, 54);
  });
});
