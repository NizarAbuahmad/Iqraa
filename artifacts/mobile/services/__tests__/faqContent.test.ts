/**
 * The FAQ's data: complete in both languages, and findable.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/faqContent.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { FAQ_CATEGORIES, FAQ_ENTRIES, filterFaq, foldForSearch } from '../faqContent.ts';
import { getT, type Lang } from '../i18n.ts';

const LANGS: Lang[] = ['ar', 'en'];

describe('FAQ content', () => {
  it('answers every question in both languages, and none is a bare key', () => {
    for (const lang of LANGS) {
      const t = getT(lang);
      for (const e of FAQ_ENTRIES) {
        for (const key of [e.q, e.a]) {
          const text = t(key);
          assert.ok(text && text !== key, `${key} (${lang}) is missing`);
        }
      }
    }
  });

  it('has no duplicate question and puts every entry in a real category', () => {
    assert.equal(new Set(FAQ_ENTRIES.map(e => e.q)).size, FAQ_ENTRIES.length);
    const ids = new Set(FAQ_CATEGORIES.map(c => c.id));
    for (const e of FAQ_ENTRIES) assert.ok(ids.has(e.category), e.q);
    for (const c of FAQ_CATEGORIES) {
      assert.ok(FAQ_ENTRIES.some(e => e.category === c.id), `${c.id} is an empty chip`);
    }
  });

  it('keeps the original nine questions', () => {
    for (let i = 1; i <= 9; i++) assert.ok(FAQ_ENTRIES.some(e => e.q === `faqQ${i}`), `faqQ${i}`);
  });
});

describe('filterFaq', () => {
  const t = getT('ar');

  it('folds hamza, ta-marbuta and tashkeel', () => {
    assert.equal(foldForSearch('الأسئلة'), foldForSearch('الاسئله'));
    assert.equal(foldForSearch('وليّ'), foldForSearch('ولي'));
  });

  it('finds a question by a loosely-spelled word', () => {
    const hits = filterFaq(FAQ_ENTRIES, 'ولي امر', 'all', t).map(e => e.q);
    assert.ok(hits.includes('faqQ14'));
  });

  it('requires every word, and returns all for an empty query', () => {
    assert.equal(filterFaq(FAQ_ENTRIES, '', 'all', t).length, FAQ_ENTRIES.length);
    assert.equal(filterFaq(FAQ_ENTRIES, 'حذف زرافة', 'all', t).length, 0);
  });

  it('narrows by category', () => {
    const hits = filterFaq(FAQ_ENTRIES, '', 'account', t);
    assert.ok(hits.length > 0 && hits.every(e => e.category === 'account'));
  });
});
