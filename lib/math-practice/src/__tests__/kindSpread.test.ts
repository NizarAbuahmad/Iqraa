/**
 * A topic generator with several kinds of question puts each kind on the paper
 * before repeating one.
 *
 * The kind used to be drawn uniformly, so a paper could hold four «ما بُعد الوتر
 * عن المركز؟» and no «ما طول المماس؟» (measured 2026-10-15; see `stemFrame`).
 * The bank is deliberately left uniform — see `makeTopicItem`.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { stemFrame, topicFor } from '../index.ts';
import { makeTopicItem } from '../topics.ts';

/** mulberry32 — a seeded rng so a failure names a reproducible draw. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const kindsOf = (stems: string[]) => {
  const counts = new Map<string, number>();
  for (const s of stems) counts.set(stemFrame(s), (counts.get(stemFrame(s)) ?? 0) + 1);
  return counts;
};

describe('a topic generator spreads its draws over its kinds of question', () => {
  // Three kinds: distance of a chord from the centre, length of a chord, length of a tangent.
  const chords = topicFor('أوتار الدائرة وأقطارها ومماساتها', 10)!;

  // Deterministic: seeded draws, so the count below is exact for this code. A
  // kind's own numbers can run out (no fresh tangent left), so not every seed
  // balances; a uniform draw balanced 17 of these 40, this one 37.
  it('puts each kind on a nine-item paper three times, nearly always', () => {
    let balanced = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const used = new Set<string>();
      const rng = seeded(seed * 7919);
      const stems = Array.from({ length: 9 }, () => makeTopicItem(chords, 10, 'medium', used, rng).promptAr!);
      const kinds = kindsOf(stems);
      assert.equal(kinds.size, 3, `seed ${seed}: ${[...kinds.keys()].join(' | ')}`);
      if (Math.max(...kinds.values()) === 3) balanced += 1;
    }
    assert.ok(balanced >= 35, `only ${balanced} of 40 papers balanced`);
  });

  it('still draws one item when nothing has been served — the first draw is not searched', () => {
    const item = makeTopicItem(chords, 10, 'medium', new Set(), seeded(1));
    assert.ok(item.promptAr);
  });
});
