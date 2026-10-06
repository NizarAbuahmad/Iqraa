/**
 * Display conversion for lab numbers. Maths stays latin everywhere else
 * (CLAUDE.md); this is the one place digits become Arabic-Indic.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { formatLabNumber, formatScientific, parseLabNumber, toArabicDigits } from '../labFormat.ts';

describe('toArabicDigits', () => {
  it('converts digits and the decimal point', () => {
    assert.equal(toArabicDigits('12.5'), '١٢٫٥');
    assert.equal(toArabicDigits('0'), '٠');
  });
  it('leaves other characters alone', () => {
    assert.equal(toArabicDigits('3 g/mol'), '٣ g/mol');
  });
});

describe('formatLabNumber', () => {
  it('rounds and trims trailing zeros', () => {
    assert.equal(formatLabNumber(12.5, 'en'), '12.5');
    assert.equal(formatLabNumber(2, 'en'), '2');
    assert.equal(formatLabNumber(0.1 + 0.2, 'en'), '0.3');
    assert.equal(formatLabNumber(18.0153, 'en', 3), '18.015');
  });
  it('uses Arabic digits for ar', () => {
    assert.equal(formatLabNumber(12.5, 'ar'), '١٢٫٥');
  });
  it('never prints negative zero', () => {
    assert.equal(formatLabNumber(-0.0000001, 'en'), '0');
  });
  it('prints a dash for a non-finite value', () => {
    assert.equal(formatLabNumber(Number.NaN, 'en'), '—');
    assert.equal(formatLabNumber(Number.POSITIVE_INFINITY, 'ar'), '—');
  });
});

describe('formatScientific', () => {
  it('splits mantissa and exponent so the screen can raise the exponent', () => {
    assert.deepEqual(formatScientific(6.022e23, 'en'), { mantissa: '6.022', exponent: '23' });
    assert.deepEqual(formatScientific(6.022e23, 'ar'), { mantissa: '٦٫٠٢٢', exponent: '٢٣' });
  });
  it('trims a zero tail from the mantissa', () => {
    assert.deepEqual(formatScientific(3e10, 'en'), { mantissa: '3', exponent: '10' });
  });
  it('uses a true minus sign for negative exponents', () => {
    assert.deepEqual(formatScientific(1.5e-5, 'en'), { mantissa: '1.5', exponent: '−5' });
  });
  it('has no exponent for zero', () => {
    assert.deepEqual(formatScientific(0, 'en'), { mantissa: '0', exponent: null });
  });
});

describe('parseLabNumber', () => {
  it('reads latin, Arabic-Indic and Persian digits', () => {
    assert.equal(parseLabNumber('36'), 36);
    assert.equal(parseLabNumber('٣٦'), 36);
    assert.equal(parseLabNumber('۳۶'), 36);
  });
  it('accepts one decimal separator: . , or ٫', () => {
    assert.equal(parseLabNumber('١٫٥'), 1.5);
    assert.equal(parseLabNumber('1,5'), 1.5);
    assert.equal(parseLabNumber('.5'), 0.5);
    assert.equal(parseLabNumber('5.'), 5);
  });
  it('trims surrounding whitespace', () => {
    assert.equal(parseLabNumber('  2 '), 2);
  });
  it('returns NaN for anything that is not a plain non-negative decimal', () => {
    for (const bad of ['', 'abc', '1e5', 'Infinity', '-1', '+1', '0x10', '1 2', '1,000.5', '1.2.3', '.', ',']) {
      assert.ok(Number.isNaN(parseLabNumber(bad)), `expected NaN for ${JSON.stringify(bad)}`);
    }
  });
});
