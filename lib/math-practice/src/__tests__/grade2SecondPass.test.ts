/**
 * Grade 2 second pass (review, 2026-11-17): the generators were run over every
 * Grade 2 maths lesson and each quiz was read against its objective. Every key
 * was right; these are the places where a question still did not fit the book
 * after «Grade 2 review: fifteen maths lessons…» (which split the data unit,
 * kept the division relation in Grade 2's tables and shortened the eraser).
 *
 * - Grade 2 numbers stay within three places (S1 «ضمن 3 منازل»), but an
 *   estimated sum reached 1158 and its options 1300; mental-maths, dinar and
 *   metre options offered 1081 and 5000.
 * - «الغرام والكيلوغرام» / «اللتر والمليلتر» ask to tell the units apart and pick
 *   the fitting one; they asked «7 كيلوغرامات = ؟ غرام» (7000) instead.
 * - «2 عشرات», «1 مئات»: a count of one or two takes the singular or the dual.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TOPICS, makeTopicItem } from '../topics.ts';
import type { ConcreteItem, DiffTier } from '../index.ts';

const TIERS: DiffTier[] = ['easy', 'medium', 'hard'];
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
function draws(id: string, grade = 2, n = 400): ConcreteItem[] {
  const t = TOPICS.find(x => x.id === id);
  assert.ok(t, `no generator ${id}`);
  return Array.from({ length: n }, (_, i) => makeTopicItem(t, grade, TIERS[i % 3]!, new Set(), seeded(i * 7919 + 13)));
}
const nums = (s: string) => (s.match(/\d+/g) ?? []).map(Number);
const all = (i: ConcreteItem) => `${i.promptAr} ${i.answer} ${i.wrongs.join(' ')}`;

describe('Grade 2 second pass (review, 2026-11-17)', () => {
  it('estimating a sum or a difference stays within 999 — stem, answer and options', () => {
    for (const id of ['est_add', 'est_sub']) {
      for (const item of draws(id)) for (const n of nums(all(item))) assert.ok(n <= 999, `${id}: ${all(item)}`);
    }
  });

  it('nor do the wrong options of mental adding and subtracting, the dinar or the metre', () => {
    for (const id of ['mental_mult_add_g2', 'mental_mult_sub_g2', 'dinar', 'units_m_g2']) {
      for (const item of draws(id)) for (const n of nums(all(item))) assert.ok(n <= 999, `${id}: ${all(item)}`);
    }
  });

  it('…and Grade 3 still estimates four-digit sums', () => {
    assert.ok(draws('est_add', 3).some(i => nums(all(i)).some(n => n > 999)));
  });

  it('grams and millilitres: no four-digit amount, and the unit that fits is still asked', () => {
    for (const id of ['units_kg_g2', 'units_l_g2']) {
      let fit = 0;
      for (const item of draws(id)) {
        // «1 كيلوغرام = 1000 غرام» is the fact the stem states; nothing else may pass 999
        const t = all(item).replace(/= 1000 /g, '= ');
        for (const n of nums(t)) assert.ok(n <= 999, `${id}: ${all(item)}`);
        if (/الوحدة المناسبة/.test(item.promptAr!)) fit += 1;
      }
      assert.ok(fit >= 60, `${id}: only ${fit} of 400 ask which unit fits`);
    }
  });

  it('the new gram and millilitre kinds: totals recomputed', () => {
    for (const id of ['units_kg_g2', 'units_l_g2']) {
      let sums = 0;
      for (const item of draws(id)) {
        const p = item.promptAr!;
        const m = p.match(/(\d+) (?:غرامًا|غرام|مليلترًا|مليلتر)[^\d]+(\d+) (?:غرامًا|غرام|مليلترًا|مليلتر)/);
        if (m && /كم (?:غرامًا|مليلترًا) (?:في|معًا)/.test(p) && !/نضيف/.test(p)) {
          sums += 1;
          assert.equal(Number(item.answer), Number(m[1]) + Number(m[2]), p);
        }
      }
      assert.ok(sums > 0, `${id}: no total kind drawn`);
    }
  });

  it('counts of one or two hundreds or tens are never «1 مئات» or «2 عشرات»', () => {
    for (const id of ['hundreds_a', 'hundreds_b']) {
      for (const item of draws(id)) assert.doesNotMatch(item.promptAr!, /(?:^|\s)[12] (?:مئات|عشرات|آحاد)/, item.promptAr);
    }
    for (const item of draws('thousands', 3)) assert.doesNotMatch(item.promptAr!, /(?:^|\s)[12] (?:آلاف|مئات|عشرات|آحاد)/, item.promptAr);
  });
});
