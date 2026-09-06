/**
 * Activity type labels.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/activityType.test.ts
 *
 * Lives under services/__tests__ because that is the only directory the test
 * script globs; the module it covers is in constants/.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTIVITY_TYPE_IDS,
  ACTIVITY_TYPE_LABEL_KEY,
  activityTypeLabel,
} from '../../constants/activityType.ts';
import translations, { getT } from '../i18n.ts';

describe('activityTypeLabel', () => {
  it('translates every id the form can send, in both languages', () => {
    for (const lang of ['ar', 'en'] as const) {
      const t = getT(lang);
      for (const id of ACTIVITY_TYPE_IDS) {
        const label = activityTypeLabel(id, t);
        assert.ok(label.trim().length > 0, `${lang}.${id} rendered empty`);
        assert.notEqual(label, id, `${lang}.${id} rendered the raw id`);
      }
    }
  });

  it('keeps every label key real — a missing one would print the key name', () => {
    for (const key of Object.values(ACTIVITY_TYPE_LABEL_KEY)) {
      assert.ok(key in translations.en, `${key} is not a translation key`);
      assert.ok(key in translations.ar, `${key} is missing from Arabic`);
    }
  });

  it('shows what the generator said when it invents a type', () => {
    // Live AI is not bound to the form's five ids. Echoing the value beats a
    // placeholder, and beats silently calling it something it is not.
    assert.equal(activityTypeLabel('jigsaw', getT('en')), 'jigsaw');
  });

  it('gives an empty string for nothing, so a caller can skip the row', () => {
    const t = getT('ar');
    assert.equal(activityTypeLabel('', t), '');
    assert.equal(activityTypeLabel(null, t), '');
    assert.equal(activityTypeLabel(undefined, t), '');
    assert.equal(activityTypeLabel('   ', t), '');
  });
});
