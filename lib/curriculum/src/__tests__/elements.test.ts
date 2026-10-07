/**
 * The element dataset (`elements.ts`).
 *
 * The Arabic names are the part most likely to be wrong, and a wrong one reads
 * as plausible Arabic. So each name must appear in the printed textbook text
 * ("witness"), not just look right. The configuration is computed, not stored,
 * and cross-checked against the stored period.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  ELEMENTS,
  electronConfiguration,
  elementBySymbol,
  formatConfiguration,
  getElement,
  shellCounts,
} from '../elements.ts';
import { normalizeArabic } from '../arabic.ts';

function bookText(file: string): string {
  const doc = JSON.parse(readFileSync(new URL(`../data/extracted/${file}`, import.meta.url), 'utf8')) as {
    text: Array<{ page: number; text: string }>;
  };
  return normalizeArabic(doc.text.map(p => p.text).join('\n'));
}

/**
 * Whole-word match for a normalised name in a normalised corpus. A bare
 * `includes` already produced one false witness: «الأرجون» is a substring of
 * «الأرجونيت» (aragonite), a mineral, not the gas. The name has to be bounded by
 * non-letters, with one optional leading clitic (و ب ك ل ف) so «بالصوديوم» and
 * «والنيتروجين» still count.
 */
export function printsAsWord(corpus: string, normalisedName: string): boolean {
  const escaped = normalisedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\u0621-\\u064A])[وبكلف]?${escaped}(?![\\u0621-\\u064A])`).test(corpus);
}

describe('printsAsWord', () => {
  const argon = normalizeArabic('الأرجون');
  it('matches a name standing on its own, in a line or a list', () => {
    assert.ok(printsAsWord(normalizeArabic('غاز الأرجون خامل'), argon));
    assert.ok(printsAsWord(normalizeArabic('(الأرجون)، النيون'), argon));
    assert.ok(printsAsWord(normalizeArabic('الأرجون'), argon));
  });
  it('matches a name after one clitic letter', () => {
    assert.ok(printsAsWord(normalizeArabic('يتفاعل مع بالأرجون'), argon));
    assert.ok(printsAsWord(normalizeArabic('والأرجون'), argon));
  });
  it('does not match a fragment inside a longer word', () => {
    assert.equal(printsAsWord(normalizeArabic('معدن الأرجونيت'), argon), false);
    assert.equal(printsAsWord(normalizeArabic('الأرجونا'), argon), false);
  });
  it('does not match after two letters of a longer word', () => {
    assert.equal(printsAsWord(normalizeArabic('تالأرجون'), argon), false);
    assert.equal(printsAsWord(normalizeArabic('كتابالأرجون'), argon), false);
  });
});

describe('the element table', () => {
  it('holds elements 1–20 in order, with unique symbols', () => {
    assert.deepEqual(ELEMENTS.map(e => e.z), Array.from({ length: 20 }, (_, i) => i + 1));
    assert.equal(new Set(ELEMENTS.map(e => e.symbol)).size, 20);
  });

  it('looks elements up by number and symbol', () => {
    assert.equal(getElement(11)?.symbol, 'Na');
    assert.equal(getElement(21), undefined);
    assert.equal(elementBySymbol('Cl')?.z, 17);
    assert.equal(elementBySymbol('cl'), undefined, 'symbols are case-sensitive');
  });

  it('prints every Arabic name in the grade 10 or grade 9 chemistry book', () => {
    const corpus = [
      'chem-s1-student-book.json',
      'chem-s2-student-book.json',
      'g9-chemistry-s1-student-book.json',
    ]
      .map(bookText)
      .join('\n');
    const missing = ELEMENTS.filter(e => !printsAsWord(corpus, normalizeArabic(e.nameAr))).map(
      e => `${e.symbol} ${e.nameAr}`,
    );
    assert.deepEqual(missing, [], 'these names are not printed in the book — use the book\'s spelling');
  });

  it('agrees with the book on the masses a teacher will check against', () => {
    // Pinned values: the calculator's answers must match the book's answer key,
    // which calculates with the rounded masses (grade 10 chemistry S2: H = 1,
    // O = 16, Na = 23; Cl = 35.5 in the S2 teacher packs). The book's table 1
    // also lists 1.008 and 15.999 but tells the student to use the rounded ones.
    assert.equal(elementBySymbol('H')?.atomicMass, 1);
    assert.equal(elementBySymbol('O')?.atomicMass, 16);
    assert.equal(elementBySymbol('Na')?.atomicMass, 23);
    assert.equal(elementBySymbol('Cl')?.atomicMass, 35.5);
  });
});

describe('electron configuration', () => {
  it('fills 1s 2s 2p 3s 3p 4s in order', () => {
    assert.equal(formatConfiguration(1), '1s1');
    assert.equal(formatConfiguration(11), '1s2 2s2 2p6 3s1');
    assert.equal(formatConfiguration(20), '1s2 2s2 2p6 3s2 3p6 4s2');
  });

  it('places exactly Z electrons for every element', () => {
    for (const e of ELEMENTS) {
      const total = electronConfiguration(e.z).reduce((s, c) => s + c.electrons, 0);
      assert.equal(total, e.z, e.symbol);
    }
  });

  it('puts the stored period at the highest occupied shell', () => {
    for (const e of ELEMENTS) {
      const top = Math.max(...electronConfiguration(e.z).map(c => c.n));
      assert.equal(e.period, top, `${e.symbol}: period vs configuration`);
    }
  });

  it('counts electrons per shell', () => {
    assert.deepEqual(shellCounts(11), [2, 8, 1]);
    assert.deepEqual(shellCounts(18), [2, 8, 8]);
    assert.deepEqual(shellCounts(20), [2, 8, 8, 2]);
  });

  it('returns nothing outside the covered range', () => {
    assert.deepEqual(electronConfiguration(0), []);
    assert.deepEqual(electronConfiguration(21), []);
    assert.equal(formatConfiguration(21), '');
  });
});
