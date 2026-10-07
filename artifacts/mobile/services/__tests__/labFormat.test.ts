/**
 * Display conversion for lab numbers. Maths stays latin everywhere else
 * (CLAUDE.md); this is the one place digits become Arabic-Indic.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { formatLabNumber, formatLabQuantity, formatScientific, parseLabNumber, toArabicDigits } from '../labFormat.ts';

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

describe('formatLabNumber at the extremes', () => {
  it('never prints JS e-notation for a huge value', () => {
    assert.equal(formatLabNumber(1e21, 'en'), '1 × 10^21');
    assert.equal(formatLabNumber(-6.022e23, 'en'), '-6.022 × 10^23');
    assert.equal(formatLabNumber(6.022e23, 'ar'), '٦٫٠٢٢ × ١٠^٢٣');
  });
  it('never prints JS e-notation for a tiny value with many fraction digits', () => {
    assert.equal(formatLabNumber(1e-7, 'en', 20), '1 × 10^−7');
    assert.doesNotMatch(formatLabNumber(1.66e-21, 'en', 25), /e/);
  });
  it('still prints an ordinary large number in full', () => {
    assert.equal(formatLabNumber(123456789, 'en'), '123456789');
  });
});

describe('formatLabQuantity', () => {
  it('is formatLabNumber for an ordinary value', () => {
    assert.deepEqual(formatLabQuantity(18.015, 'en', 3), { text: '18.015', exponent: null });
    assert.deepEqual(formatLabQuantity(0.001, 'en', 4), { text: '0.001', exponent: null });
    assert.deepEqual(formatLabQuantity(999999, 'ar', 3), { text: '٩٩٩٩٩٩', exponent: null });
    assert.deepEqual(formatLabQuantity(0, 'en', 4), { text: '0', exponent: null });
  });
  it('goes scientific below 1e-3, so 1000 particles is not shown as 0 mol', () => {
    assert.deepEqual(formatLabQuantity(1000 / 6.022e23, 'en', 4), { text: '1.661 × 10', exponent: '−21' });
    assert.deepEqual(formatLabQuantity(1000 / 6.022e23, 'ar', 4), { text: '١٫٦٦١ × ١٠', exponent: '−٢١' });
    assert.deepEqual(formatLabQuantity(0.0005, 'en', 4), { text: '5 × 10', exponent: '−4' });
  });
  it('goes scientific from 1e6 up', () => {
    assert.deepEqual(formatLabQuantity(6.022e23, 'en', 4), { text: '6.022 × 10', exponent: '23' });
    assert.deepEqual(formatLabQuantity(1e6, 'en', 3), { text: '1 × 10', exponent: '6' });
  });
  it('prints a dash for a non-finite value', () => {
    assert.deepEqual(formatLabQuantity(Number.POSITIVE_INFINITY, 'en', 3), { text: '—', exponent: null });
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

describe('parseLabNumber thousands separators', () => {
  it('refuses digits, one comma and exactly three digits: thousands or decimal is ambiguous', () => {
    for (const ambiguous of ['1,000', '12,345', '0,500', '1٬000', '١٬٠٠٠', '١٢,٣٤٥']) {
      assert.ok(Number.isNaN(parseLabNumber(ambiguous)), `expected NaN for ${JSON.stringify(ambiguous)}`);
    }
  });
  it('keeps a comma with other digit counts as a decimal', () => {
    assert.equal(parseLabNumber('1,5'), 1.5);
    assert.equal(parseLabNumber('1,50'), 1.5);
    assert.equal(parseLabNumber('1,0005'), 1.0005);
    assert.equal(parseLabNumber(',5'), 0.5);
  });
  it('always reads «٫» as the decimal mark, even before three digits', () => {
    assert.equal(parseLabNumber('١٫٥٠٠'), 1.5);
    assert.equal(parseLabNumber('1٫000'), 1);
  });
});

describe('parseLabNumber exponent form', () => {
  it('reads e / E notation', () => {
    assert.equal(parseLabNumber('6.022e23'), 6.022e23);
    assert.equal(parseLabNumber('1.204E24'), 1.204e24);
    assert.equal(parseLabNumber('5e-3'), 0.005);
    assert.equal(parseLabNumber('5e+3'), 5000);
    assert.equal(parseLabNumber('.5e1'), 5);
    assert.equal(parseLabNumber('5.e2'), 500);
    assert.equal(parseLabNumber('1,5e3'), 1500);
  });
  it('reads ×10^n, x10^n and *10^n', () => {
    assert.equal(parseLabNumber('6.022×10^23'), 6.022e23);
    assert.equal(parseLabNumber('6.022x10^23'), 6.022e23);
    assert.equal(parseLabNumber('6.022*10^23'), 6.022e23);
    assert.equal(parseLabNumber('6.022 × 10^23'), 6.022e23);
    assert.equal(parseLabNumber('2×10^-3'), 0.002);
    assert.equal(parseLabNumber('2×10^−3'), 0.002);
    assert.equal(parseLabNumber('2×10^+3'), 2000);
  });
  it('reads Arabic-Indic digits and «٫» in exponent form', () => {
    assert.equal(parseLabNumber('٦٫٠٢٢e٢٣'), 6.022e23);
    assert.equal(parseLabNumber('٦٫٠٢٢×١٠^٢٣'), 6.022e23);
  });
  it('rejects anything that is not strictly mantissa plus exponent', () => {
    for (const bad of ['1e', 'e5', '1e1000', '1e+', '1e5.5', '-1e5', '+1e5', '1e-', '1e5e5', '1×10', '1×10^', '1x2^3', '10^5', 'Infinity', 'NaN', '1e999', '1e 5']) {
      assert.ok(Number.isNaN(parseLabNumber(bad)), `expected NaN for ${JSON.stringify(bad)}`);
    }
  });
  it('never returns Infinity', () => {
    assert.ok(Number.isNaN(parseLabNumber('9e999')));
    assert.ok(Number.isNaN(parseLabNumber('9×10^999')));
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
  it('returns NaN for anything that is not a non-negative decimal or strict exponent form', () => {
    for (const bad of ['', 'abc', 'Infinity', '-1', '+1', '0x10', '1 2', '1,000.5', '1.2.3', '.', ',', '1,2,3']) {
      assert.ok(Number.isNaN(parseLabNumber(bad)), `expected NaN for ${JSON.stringify(bad)}`);
    }
  });
});
