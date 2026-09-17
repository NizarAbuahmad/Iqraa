/**
 * What this guards: the curriculum browser filtering to a teacher's picked
 * grades/subjects must never render an empty screen — a stale selection (the
 * MVP catalog shrinking under it) has to fall back to the full list rather
 * than showing nothing with no way out.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { narrowToSelection } from '../teacherCatalogFilter.ts';

const CATALOG = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('narrowToSelection', () => {
  it('keeps only the selected ids, in the catalog\'s own order', () => {
    assert.deepEqual(narrowToSelection(CATALOG, ['c', 'a']), [{ id: 'a' }, { id: 'c' }]);
  });

  it('returns the full list when nothing is selected yet', () => {
    assert.deepEqual(narrowToSelection(CATALOG, []), CATALOG);
    assert.deepEqual(narrowToSelection(CATALOG, undefined), CATALOG);
  });

  it('falls back to the full list rather than rendering empty', () => {
    // Every picked id has since dropped out of the catalog — narrowing here
    // would otherwise leave an unexplained blank screen with no way out.
    assert.deepEqual(narrowToSelection(CATALOG, ['does-not-exist']), CATALOG);
  });
});
