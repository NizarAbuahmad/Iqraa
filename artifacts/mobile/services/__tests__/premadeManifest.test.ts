/**
 * How a re-run of `scripts/build-premade-sheets.ts` changes the manifest.
 *
 * The defect this guards: the manifest was upserted, so a lesson the generator
 * had since started REFUSING (no question bank for it) kept its old sheet for
 * ever — padded with repeated filler the generator no longer produces. A sheet
 * the build refuses must leave the manifest, not linger in it.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { mergeSheets } from '../premadeManifest.ts';

const sheet = (id: string, lessonId: string, level = 'medium', tag = 'old') =>
  ({ id, lessonId, level, tag }) as const;

describe('mergeSheets', () => {
  it('replaces a sheet that was regenerated and keeps the order stable', () => {
    const merged = mergeSheets(
      [sheet('pw-b-medium', 'b'), sheet('pw-a-medium', 'a')],
      [sheet('pw-b-medium', 'b', 'medium', 'new')],
      () => false,
    );
    assert.deepEqual(merged.map(s => [s.id, s.tag]), [['pw-a-medium', 'old'], ['pw-b-medium', 'new']]);
  });

  it('keeps a sheet nothing touched — a --only run must not erase the rest', () => {
    const merged = mergeSheets([sheet('pw-a-medium', 'a'), sheet('pw-b-medium', 'b')], [], () => false);
    assert.equal(merged.length, 2);
  });

  it('drops the old sheet of a lesson the build refused', () => {
    const refused = new Set(['pw-b-medium']);
    const merged = mergeSheets(
      [sheet('pw-a-medium', 'a'), sheet('pw-b-medium', 'b')],
      [],
      s => refused.has(s.id),
    );
    assert.deepEqual(merged.map(s => s.id), ['pw-a-medium']);
  });

  it('drops a refused lesson at this level only, not its other levels', () => {
    const merged = mergeSheets(
      [sheet('pw-b-easy', 'b', 'easy'), sheet('pw-b-medium', 'b', 'medium')],
      [],
      s => s.id === 'pw-b-medium',
    );
    assert.deepEqual(merged.map(s => s.id), ['pw-b-easy']);
  });

  it('applies the drop rule after the upsert, as the held-back filter always did', () => {
    // Held back means held back, even if something produced a sheet for it this run.
    const merged = mergeSheets(
      [sheet('pw-b-medium', 'b')],
      [sheet('pw-b-medium', 'b', 'medium', 'new')],
      s => s.lessonId === 'b',
    );
    assert.deepEqual(merged, []);
  });
});
