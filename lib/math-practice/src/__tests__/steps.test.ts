/**
 * The worked solutions have to agree with the bank they explain.
 *
 * A worked example is the one place on a worksheet that a student studies
 * rather than answers, so a wrong or mismatched line there teaches the wrong
 * thing to the whole class. These invariants are the ones a script can check;
 * the mathematics itself was checked with SymPy when the steps were written.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { CHEM_BANK, MATH_BANK, type ConcreteItem } from '../index.ts';
import { solvedItemIds, stepsFor } from '../steps.ts';

const ALL: ConcreteItem[] = [...MATH_BANK, ...CHEM_BANK];
const byId = new Map(ALL.map(i => [i.id, i]));

/** Whitespace and the Arabic comma variants are layout, not content. */
const squash = (s: string) => s.replace(/[\s،,]+/g, '');

describe('worked solutions', () => {
  it('only exist for items that exist', () => {
    const orphans = solvedItemIds().filter(id => !byId.has(id));
    assert.deepEqual(orphans, []);
  });

  it('give the same number of steps in both languages, none empty', () => {
    for (const id of solvedItemIds()) {
      const s = stepsFor(id)!;
      assert.equal(s.ar.length, s.en.length, `${id}: ar and en step counts differ`);
      assert.ok(s.ar.length >= 2 && s.ar.length <= 6, `${id}: ${s.ar.length} steps, want 2 to 6`);
      for (const line of [...s.ar, ...s.en]) assert.ok(line.trim().length > 0, `${id}: empty step`);
    }
  });

  it('end on the item\'s own answer, so the working and the key cannot disagree', () => {
    for (const id of solvedItemIds()) {
      const item = byId.get(id)!;
      const last = stepsFor(id)!.ar.at(-1)!;
      assert.ok(
        squash(last).includes(squash(item.answer)),
        `${id}: last Arabic step «${last}» does not contain the answer «${item.answer}»`,
      );
    }
  });

  it('keep latin variables, converting to Arabic letters only at display time', () => {
    // «س» / «ص» as a lone variable would be shown twice-converted. Whole words
    // that merely contain the letter are fine, so look for it standing alone.
    const lone = /(^|[\s(=+\-×÷*/^])[سص]($|[\s)=+\-×÷*/^²³.,؟])/u;
    for (const id of solvedItemIds()) {
      for (const line of stepsFor(id)!.ar) assert.ok(!lone.test(line), `${id}: Arabic variable in «${line}»`);
    }
  });

  it('cover every bank family with at least two solved items', () => {
    // A paper needs two: one to study, one to finish half-solved.
    const families = new Map<string, number>();
    for (const item of ALL) if (!families.has(item.family)) families.set(item.family, 0);
    for (const id of solvedItemIds()) {
      const fam = byId.get(id)?.family;
      if (fam) families.set(fam, (families.get(fam) ?? 0) + 1);
    }
    const thin = [...families].filter(([, n]) => n < 2).map(([f, n]) => `${f}:${n}`);
    assert.deepEqual(thin, [], 'families with fewer than two solved items');
  });
});
