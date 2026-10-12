/**
 * Route helpers. A surah URL is shareable, so what arrives in the param is
 * untrusted: it resolves to a surah the books assign, or to nothing.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { QURAN_ROUTE, memorizePath, resolveSurahParam, surahPath } from '../quranLinks.ts';

describe('paths', () => {
  it('builds the reader and memorise paths under /curriculum', () => {
    assert.equal(QURAN_ROUTE, '/curriculum/quran');
    assert.equal(surahPath(112), '/curriculum/quran/112');
    assert.equal(memorizePath(112), '/curriculum/quran/112/memorize');
  });
});

describe('resolveSurahParam', () => {
  it('resolves a surah the books assign, including from an array param', () => {
    assert.equal(resolveSurahParam('112')?.number, 112);
    assert.equal(resolveSurahParam(['96', 'x'])?.number, 96);
  });

  it('returns null for a surah the books do not assign, and for anything that is not a number', () => {
    for (const bad of ['0', '5', '115', '999', 'abc', '1e2', '-1', '1.5', '', undefined]) {
      assert.equal(resolveSurahParam(bad), null, String(bad));
    }
    assert.equal(resolveSurahParam([]), null);
  });
});
