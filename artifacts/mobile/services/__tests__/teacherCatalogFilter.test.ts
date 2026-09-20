/**
 * What this guards: the curriculum browser filtering to a teacher's picked
 * grades/subjects must never render an empty screen — a stale selection (the
 * MVP catalog shrinking under it) has to fall back to the full list rather
 * than showing nothing with no way out.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { narrowSubjectsForGrade, narrowToSelection, resolveSelectedId } from '../teacherCatalogFilter.ts';

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

describe('narrowSubjectsForGrade', () => {
  const ASSIGNMENTS = [
    { gradeId: 'grade-7', subjectIds: ['a'] },
    { gradeId: 'grade-8', subjectIds: ['b', 'c'] },
  ];

  it('narrows to only the matching grade\'s own subjects, not every grade\'s', () => {
    assert.deepEqual(narrowSubjectsForGrade(CATALOG, 'grade-7', ASSIGNMENTS, undefined), [{ id: 'a' }]);
    assert.deepEqual(narrowSubjectsForGrade(CATALOG, 'grade-8', ASSIGNMENTS, undefined), [{ id: 'b' }, { id: 'c' }]);
  });

  it('falls back to the flat legacy list when this grade has no assignment', () => {
    assert.deepEqual(narrowSubjectsForGrade(CATALOG, 'grade-9', undefined, ['a', 'c']), [{ id: 'a' }, { id: 'c' }]);
    assert.deepEqual(narrowSubjectsForGrade(CATALOG, 'grade-9', [], ['a', 'c']), [{ id: 'a' }, { id: 'c' }]);
  });

  it('falls back to the full catalog when neither is set', () => {
    assert.deepEqual(narrowSubjectsForGrade(CATALOG, 'grade-9', undefined, undefined), CATALOG);
  });
});

describe('resolveSelectedId', () => {
  it('keeps a selection that is still on offer', () => {
    assert.equal(resolveSelectedId(CATALOG, 'b'), 'b');
  });

  it('drops a selection the new list no longer holds', () => {
    // The new-class sheet after the teacher switches grade: 'b' belonged to
    // the previous grade, and must not be what createClass persists.
    assert.equal(resolveSelectedId([{ id: 'c' }], 'b'), 'c');
  });

  it('is empty rather than stale when there is nothing to pick', () => {
    assert.equal(resolveSelectedId([], 'b'), '');
  });
});
