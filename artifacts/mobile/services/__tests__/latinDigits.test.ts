import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { toLatinDigits } from '../latinDigits.ts';

describe('toLatinDigits', () => {
  it('folds Arabic-Indic and Eastern Arabic-Indic digits to ASCII', () => {
    assert.equal(toLatinDigits('٠١٢٣٤٥٦٧٨٩'), '0123456789');
    assert.equal(toLatinDigits('۰۱۲۳۴۵۶۷۸۹'), '0123456789');
  });

  it('leaves everything else alone', () => {
    assert.equal(toLatinDigits('12:٣٠ س'), '12:30 س');
    assert.equal(toLatinDigits(''), '');
  });

  it('makes a typed Arabic mark numeric', () => {
    assert.equal(Number(toLatinDigits('٢')), 2);
    assert.ok(Number.isNaN(Number('٢')), 'the premise: Number() does not read Arabic digits');
  });
});
