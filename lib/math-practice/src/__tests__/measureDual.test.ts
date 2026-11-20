/**
 * Two lengths are a dual (Grade 1 audit, 2026-11-14): «قيس طولا شيئين», as the
 * mass and capacity stems already said «قيست كتلتا / سعتا شيئين». The stem used
 * to read «قيست أطوال شيئين» — a plural for two things.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TOPICS, makeTopicItem } from '../topics.ts';

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('two measures are a dual', () => {
  for (const [id, want] of [['compare_len', 'قيس طولا شيئين'], ['compare_mass', 'قيست كتلتا شيئين'], ['compare_cap', 'قيست سعتا شيئين']] as const) {
    it(`${id}: «${want}», never a plural for two things`, () => {
      const t = TOPICS.find(x => x.id === id)!;
      let seen = false;
      for (let i = 0; i < 300; i++) {
        const p = makeTopicItem(t, 1, (['easy', 'medium', 'hard'] as const)[i % 3], new Set(), seeded(i)).promptAr ?? '';
        assert.ok(!/(?:أطوال|كتل|سعات) شيئين/.test(p), p);
        if (p.includes(want)) seen = true;
      }
      assert.ok(seen, `«${want}» is drawn`);
    });
  }
});
