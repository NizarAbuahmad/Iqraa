/**
 * Formula parsing and mole conversions for the lab calculator.
 *
 * The parser is the risky part: «CO» and «Co» differ by one letter's case, and
 * a calculator that quietly reads `Fe2O3` as something else would teach a wrong
 * molar mass. Anything it cannot read must come back as a named failure, not a
 * number.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { AVOGADRO, molarMass, parseFormula, solveMole } from '../labMole.ts';

function close(actual: number, expected: number, tol = 1e-6): void {
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} is not within ${tol} of ${expected}`);
}

function counts(formula: string): Record<string, number> {
  const r = parseFormula(formula);
  assert.ok(r.ok, `${formula} should parse`);
  return r.counts;
}

describe('parseFormula', () => {
  it('reads plain formulas', () => {
    assert.deepEqual(counts('H2O'), { H: 2, O: 1 });
    assert.deepEqual(counts('NaCl'), { Na: 1, Cl: 1 });
  });

  it('multiplies through parentheses', () => {
    assert.deepEqual(counts('Ca(OH)2'), { Ca: 1, O: 2, H: 2 });
    assert.deepEqual(counts('Al2(SO4)3'), { Al: 2, S: 3, O: 12 });
  });

  it('accepts subscript digits and stray spaces', () => {
    assert.deepEqual(counts(' H₂O '), { H: 2, O: 1 });
  });

  it('refuses an element outside the covered range, by name', () => {
    const r = parseFormula('Fe2O3');
    assert.deepEqual(r, { ok: false, reason: 'unknown-element', detail: 'Fe' });
  });

  it('is case-sensitive: lowercase and mis-cased symbols are not guessed', () => {
    assert.equal(parseFormula('h2o').ok, false);
    const co = parseFormula('Co');
    assert.equal(co.ok, false);
    assert.equal(!co.ok && co.reason, 'unknown-element');
  });

  it('refuses malformed input rather than guessing', () => {
    for (const bad of ['Ca(OH', 'H2O)', '2H2O', 'H0', 'H2$', '()']) {
      const r = parseFormula(bad);
      assert.equal(r.ok, false, bad);
      assert.equal(!r.ok && r.reason, 'syntax', bad);
    }
    assert.deepEqual(parseFormula('   '), { ok: false, reason: 'empty' });
  });
});

describe('molarMass', () => {
  it('sums atomic masses', () => {
    close(molarMass(counts('H2O')), 2 * 1 + 16);
    close(molarMass(counts('CO2')), 12 + 2 * 16);
  });
});

describe('solveMole', () => {
  it('converts grams to moles and particles', () => {
    const mm = 2 * 1 + 16;
    const r = solveMole({ formula: 'H2O', known: 'grams', value: 2 * mm });
    assert.ok(r.ok);
    close(r.moles, 2);
    close(r.grams, 2 * mm);
    close(r.particles / AVOGADRO, 2, 1e-9);
  });

  it('converts moles to grams', () => {
    const r = solveMole({ formula: 'NaCl', known: 'moles', value: 0.5 });
    assert.ok(r.ok);
    close(r.grams, 0.5 * (23 + 35.5));
  });

  it('converts particles to moles', () => {
    const r = solveMole({ formula: 'CO2', known: 'particles', value: 3 * AVOGADRO });
    assert.ok(r.ok);
    close(r.moles, 3, 1e-9);
  });

  it('rejects negative or non-finite values', () => {
    for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = solveMole({ formula: 'H2O', known: 'grams', value });
      assert.deepEqual(r, { ok: false, reason: 'bad-value' });
    }
  });

  it('rejects a value whose result overflows instead of printing Infinity', () => {
    // 1e300 mol is finite on its own; times Avogadro it is not.
    assert.deepEqual(solveMole({ formula: 'H2O', known: 'moles', value: 1e300 }), { ok: false, reason: 'bad-value' });
    // 1e308 g / 18 g/mol is finite, but the particle count is not.
    assert.deepEqual(solveMole({ formula: 'H2O', known: 'grams', value: 1e308 }), { ok: false, reason: 'bad-value' });
  });

  it('passes a formula failure through unchanged', () => {
    const r = solveMole({ formula: 'Fe', known: 'grams', value: 1 });
    assert.deepEqual(r, { ok: false, reason: 'unknown-element', detail: 'Fe' });
  });
});

describe('parseFormula overflow guard', () => {
  it('rejects deeply nested multipliers that overflow to Infinity', () => {
    const formula = '('.repeat(110) + 'H' + ')1000'.repeat(110);
    assert.deepEqual(parseFormula(formula), { ok: false, reason: 'syntax' });
    assert.deepEqual(solveMole({ formula, known: 'grams', value: 1 }), { ok: false, reason: 'syntax' });
  });
  it('rejects a count above one million but allows exactly one million', () => {
    assert.deepEqual(parseFormula('(H1000)1001'), { ok: false, reason: 'syntax' });
    assert.deepEqual(counts('(H1000)1000'), { H: 1e6 });
  });
  it('rejects a count that is only too large after merging two groups', () => {
    assert.deepEqual(parseFormula('(H1000)1000(H)1000'), { ok: false, reason: 'syntax' });
  });
});
