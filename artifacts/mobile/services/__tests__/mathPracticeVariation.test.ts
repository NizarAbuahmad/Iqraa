/**
 * Concrete-bank draws vary between sessions.
 *
 *   node --experimental-strip-types --test artifacts/mobile/services/__tests__/mathPracticeVariation.test.ts
 *
 * `takeConcreteMath` used to take the *first* unused item in bank order, so
 * every fresh session (every page load, every demo) served the identical quiz
 * for a topic — regeneration only looked alive until a reload. The draw is now
 * random within the difficulty-preferred pool. `usedIds` still guarantees a
 * single generation pass never repeats an item, which is asserted here too so
 * the variation can never come at dedupe's expense.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { beginMathPracticeSession, takeConcreteMath } from '../ai/mathPractice.ts';

const TOPIC = 'الاشتقاق';

describe('takeConcreteMath — variation across sessions', () => {
  it('fresh sessions do not all open with the same item', () => {
    const firsts = new Set<string>();
    for (let trial = 0; trial < 20; trial += 1) {
      beginMathPracticeSession();
      const q = takeConcreteMath('multiple_choice', TOPIC, null, 'medium', 'ar', 2);
      assert.ok(q, 'the derivatives family should always have an item');
      firsts.add(q.text);
    }
    // With a pool of n>1 items, 20 identical draws has probability (1/n)^19 —
    // a failure here means the draw went back to being deterministic.
    assert.ok(
      firsts.size > 1,
      'twenty fresh sessions all opened with the identical question',
    );
  });

  it('still never repeats an item within one generation pass', () => {
    beginMathPracticeSession();
    const seen = new Set<string>();
    for (let i = 0; i < 5; i += 1) {
      const q = takeConcreteMath('multiple_choice', TOPIC, null, 'medium', 'ar', 2);
      if (!q) break; // family exhausted — dedupe held all the way down
      assert.ok(!seen.has(q.text), `item repeated within one pass: ${q.text}`);
      seen.add(q.text);
    }
    assert.ok(seen.size >= 2, 'expected at least two distinct items in a pass');
  });

  it('a drawn item still carries the requested points and an answer key', () => {
    beginMathPracticeSession();
    const q = takeConcreteMath('short_answer', TOPIC, null, 'medium', 'ar', 3)!;
    assert.equal(q.points, 3);
    assert.ok(q.answer && String(q.answer).length > 0);
  });
});
