/**
 * «رتّب» marks one order right. `ORDER_SAFE` lists the solved items whose
 * working (all but the pinned last line) has exactly one valid order; nothing
 * else may be drawn for it, or a student who swaps two independent steps is
 * marked wrong.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ORDER_SAFE } from '../orderSafe.ts';
import { stepsFor } from '../steps.ts';
import { pickForFormat, formatSupported } from '../formatsBank.ts';
import { ORDER_SAFE as fromIndex } from '../index.ts';

// Items a review found with steps that can swap (the indices are the swap).
const INTERCHANGEABLE = [
  'c-m1', // h / k / r
  'd-m1', // (x³)′ vs (4x)′
  't-m1', // the two quadrants
  'q-m1', // d = 4 vs the general term
  'ch-th-m1', // 0 ↔ 1
  'ch-gn-e1', // 0 ↔ 1
  'ch-gn-m2', // 1 ↔ 2
  'ch-rx-m1', // 1 ↔ 2
  'ch-rx-h1', // 2 ↔ 3
  'ch-ac-m1', // 1 ↔ 2
  'ch-th-m2', // 0 ↔ 1
];

const MATH_TOPICS = [
  'exponential equation', 'derivative', 'linear and quadratic', 'two quadratic', 'graphically',
  'simplify exponents', 'law of sines', 'equation of a circle', 'vector', 'trigonometric ratio',
  'probability', 'sequence', 'inverse function', 'linear equation',
];
const CHEM_TOPICS = [
  'stoichiometry', 'molar mass', 'enthalpy', 'chemical equation', 'chemical formula', 'covalent bond',
  'atomic radius', 'electron configuration', 'bohr', 'redox', 'activity series', 'acid', 'isotope', 'mixtures',
];

describe('ORDER_SAFE', () => {
  it('is exported from the package index', () => {
    assert.equal(fromIndex, ORDER_SAFE);
  });

  it('names only solved items with 3–6 steps', () => {
    assert.ok(ORDER_SAFE.size > 0);
    for (const id of ORDER_SAFE) {
      const s = stepsFor(id);
      assert.ok(s, `${id} has no working`);
      assert.ok(s.ar.length >= 3 && s.ar.length <= 6, `${id} has ${s.ar.length} steps`);
      assert.equal(s.en.length, s.ar.length, id);
    }
  });

  it('lists none of the items known to have interchangeable steps', () => {
    for (const id of INTERCHANGEABLE) assert.ok(!ORDER_SAFE.has(id), `${id} is listed`);
  });

  it('pickForFormat(order) never returns an unlisted item, maths or chemistry', () => {
    const cases = [
      ...MATH_TOPICS.map(t => [t, 'Mathematics'] as const),
      ...CHEM_TOPICS.map(t => [t, 'Chemistry'] as const),
    ];
    for (const [topic, subject] of cases) {
      const session = new Set<string>();
      let picks = 0;
      while (pickForFormat('order', topic, null, 'en', session, subject)) picks += 1;
      assert.equal(session.size, picks, topic);
      for (const id of session) assert.ok(ORDER_SAFE.has(id), `${topic}: drew ${id}`);
      assert.equal(formatSupported('order', topic, null, subject), picks > 0, topic);
    }
  });

  it('a family with no listed item does not offer رتّب', () => {
    assert.equal(formatSupported('order', 'mixtures', null, 'Chemistry'), false);
  });
});
