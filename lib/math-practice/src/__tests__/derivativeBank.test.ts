/**
 * The derivative family serves three Grade 10 lessons (slope of a curve,
 * differentiation, maximum and minimum values). It once held 5 items, so any
 * worksheet on them topped out at 5 whatever the picker said.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MATH_BANK } from '../index.ts';
import { solvedItemIds } from '../steps.ts';

const derivative = MATH_BANK.filter(i => i.family === 'derivative');

describe('derivative bank', () => {
  it('is deep enough for a long worksheet, in every tier', () => {
    assert.ok(derivative.length >= 20, `${derivative.length} items`);
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      assert.ok(derivative.filter(i => i.diff === tier).length >= 5, `${tier} is thin`);
    }
  });

  it('has working for most items, so a paper can study one and finish another', () => {
    const solved = new Set(solvedItemIds());
    assert.ok(derivative.filter(i => solved.has(i.id)).length >= 15);
  });

  it('has distinct options on every item, with the answer among none of the wrongs', () => {
    for (const i of derivative) {
      assert.equal(new Set(i.wrongs).size, i.wrongs.length, `${i.id}: duplicate wrongs`);
      assert.ok(!i.wrongs.includes(i.answer), `${i.id}: a wrong equals the answer`);
      assert.ok(i.wrongs.length >= 3, `${i.id}: ${i.wrongs.length} wrongs`);
    }
  });

  it('has unique ids and wording', () => {
    assert.equal(new Set(derivative.map(i => i.id)).size, derivative.length);
    assert.equal(new Set(derivative.map(i => i.promptAr)).size, derivative.length);
  });
});
