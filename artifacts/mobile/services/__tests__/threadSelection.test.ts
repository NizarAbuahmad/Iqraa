import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { allSelected, pruneSelection, toggleSelected } from '../threadSelection.ts';
import { getT } from '../i18n.ts';

describe('toggleSelected', () => {
  it('adds an id that is not selected', () => {
    assert.deepEqual([...toggleSelected(new Set(['a']), 'b')], ['a', 'b']);
  });
  it('removes an id that is selected, and an empty result ends selection mode', () => {
    assert.equal(toggleSelected(new Set(['a']), 'a').size, 0);
  });
  it('does not mutate the set it was given', () => {
    const before = new Set(['a']);
    toggleSelected(before, 'b');
    assert.deepEqual([...before], ['a']);
  });
});

describe('pruneSelection', () => {
  it('drops ids that left the list, keeps the rest', () => {
    assert.deepEqual([...pruneSelection(new Set(['a', 'b', 'c']), ['b', 'c', 'd'])], ['b', 'c']);
  });
});

describe('allSelected', () => {
  it('is false for an empty list, so «select all» never reads as already done', () => {
    assert.equal(allSelected(new Set(), []), false);
  });
  it('is true only when every visible id is picked', () => {
    assert.equal(allSelected(new Set(['a', 'b']), ['a', 'b']), true);
    assert.equal(allSelected(new Set(['a']), ['a', 'b']), false);
  });
});

describe('bulk-hide strings', () => {
  const keys = [
    'messagingSelect',
    'messagingSelectAll',
    'messagingDeselectAll',
    'messagingSelectedCount',
    'messagingBulkHide',
    'messagingBulkHideConfirmTitle',
    'messagingBulkHideConfirmDesc',
    'messagingBulkHidePartial',
  ] as const;
  for (const lang of ['ar', 'en'] as const) {
    it(`${lang} has every key`, () => {
      const t = getT(lang);
      for (const k of keys) {
        const v = t(k, 2);
        assert.ok(v && v !== k, `${lang}: ${k} missing`);
      }
    });
  }
});
