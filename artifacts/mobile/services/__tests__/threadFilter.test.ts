import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { filterThreads, THREAD_FILTERS } from '../threadFilter.ts';
import { getT } from '../i18n.ts';

const threads = [
  { id: 'd1', type: 'direct' as const },
  { id: 'c1', type: 'class_group' as const },
  { id: 'g1', type: 'custom_group' as const },
  { id: 'd2', type: 'direct' as const },
];

describe('filterThreads', () => {
  it('all keeps every thread, in order', () => {
    assert.deepEqual(filterThreads(threads, 'all').map(t => t.id), ['d1', 'c1', 'g1', 'd2']);
  });
  it('groups keeps both class and custom groups', () => {
    assert.deepEqual(filterThreads(threads, 'groups').map(t => t.id), ['c1', 'g1']);
  });
  it('direct keeps only person-to-person threads', () => {
    assert.deepEqual(filterThreads(threads, 'direct').map(t => t.id), ['d1', 'd2']);
  });
  it('groups and direct partition the list', () => {
    assert.equal(filterThreads(threads, 'groups').length + filterThreads(threads, 'direct').length, threads.length);
  });
  it('every filter has a label in both languages', () => {
    const key = { all: 'messagingFilterAll', groups: 'messagingFilterGroups', direct: 'messagingFilterDirect' } as const;
    for (const lang of ['ar', 'en'] as const) {
      const t = getT(lang);
      for (const f of THREAD_FILTERS) {
        const label = t(key[f]);
        assert.ok(label && label !== key[f], `${lang}:${f}`);
      }
    }
  });
});
