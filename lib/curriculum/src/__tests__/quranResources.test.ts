import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { QURAN_RESOURCES, validateQuranResources, type QuranResource } from '../quranResources.ts';

describe('quran resources', () => {
  it('has no structural problems', () => {
    assert.deepEqual(validateQuranResources(), []);
  });

  it('lists at least one resource', () => {
    assert.ok(QURAN_RESOURCES.length > 0);
  });

  it('rejects a plain-http link, a bad URL, a duplicate id and a malformed check date', () => {
    const base: QuranResource = { id: 'a', provider: 'A', kind: 'reader', url: 'https://a.example', urlCheckedAt: null };
    assert.match(validateQuranResources([{ ...base, url: 'http://a.example' }])[0]!, /not https/);
    assert.match(validateQuranResources([{ ...base, url: 'nope' }])[0]!, /not a URL/);
    assert.match(validateQuranResources([base, base])[0]!, /duplicate id/);
    assert.match(validateQuranResources([{ ...base, urlCheckedAt: '11/10/2026' }])[0]!, /YYYY-MM-DD/);
    assert.match(validateQuranResources([{ ...base, kind: 'video' as never }])[0]!, /unknown kind/);
  });
});
