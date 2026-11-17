/**
 * Grade 2 second pass (review, 2026-11-17): the generators were run over every
 * Grade 2 maths lesson and each quiz was read against its objective. Every key
 * was right; these are the places where a question did not fit the book.
 *
 * - Grade 2 numbers stay within three places (S1 «ضمن 3 منازل»), but an
 *   estimated sum reached 1158 and its options 1300.
 * - «الغرام والكيلوغرام» / «اللتر والمليلتر» ask to tell the units apart and pick
 *   the fitting one; they asked «7 كيلوغرامات = ؟ غرام» (7000) instead.
 * - Grade 2 divides by 2, 3, 4 and 5 (u7_l4–l7); «العلاقة بين القسمة والضرب» used
 *   6 × 7 = 42.
 * - The four data lessons shared one pool, so the tally lessons asked about
 *   pictures and the picture lessons about tallies.
 * - «2 عشرات», «1 مئات»: a count of one or two takes the singular or the dual.
 * - An eraser 19 cm long beside a pencil of 6 cm.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TOPICS, makeTopicItem, topicFor } from '../topics.ts';
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

  it('«العلاقة بين القسمة والضرب» at Grade 2 divides by 2, 3, 4 or 5 — the tables of the unit', () => {
    for (const item of draws('division_relation')) {
      const p = item.promptAr!;
      const by = p.match(/÷ (\d+)/) ?? p.match(/ضُرب في (\d+)/);
      assert.ok(by, p);
      assert.ok([2, 3, 4, 5].includes(Number(by[1])), p);
      const f = p.match(/(\d+) × (\d+)/);
      if (f) assert.ok([2, 3, 4, 5].includes(Number(f[1])) || [2, 3, 4, 5].includes(Number(f[2])), p);
      for (const n of nums(p)) assert.ok(n <= 50, p);
    }
  });

  it('…while Grade 3 keeps the full tables', () => {
    assert.ok(draws('division_relation', 3).some(i => /÷ [6-9]\b/.test(i.promptAr!)));
  });

  const PICTURES = ['تَمْثيلُ الْبَياناتِ بِالصُّوَرِ', 'تَفْسيرُ الْبَياناتِ الْمُمَثَّلَةِ بِالصُّوَرِ'];
  const TALLY = ['جَمْعُ الْبَياناتِ وَتَنْظيمُها', 'تَفْسيرُ الْبَياناتِ الْمُمَثَّلَةِ بِجَدْوَلِ الْإِشاراتِ'];

  it('the picture lessons ask about pictures, the tally lessons about tallies', () => {
    for (const title of PICTURES) {
      const t = topicFor(title, 2);
      assert.ok(t, title);
      for (const item of draws(t.id)) assert.match(item.promptAr!, /صور/, `${title}: ${item.promptAr}`);
    }
    for (const title of TALLY) {
      const t = topicFor(title, 2);
      assert.ok(t, title);
      for (const item of draws(t.id)) assert.match(item.promptAr!, /إشار|حزم|سجّل/, `${title}: ${item.promptAr}`);
      for (const item of draws(t.id)) assert.doesNotMatch(item.promptAr!, /صورة|صور /, `${title}: ${item.promptAr}`);
    }
  });

  it('a tally in words is read back to its count', () => {
    const t = topicFor(TALLY[1]!, 2)!;
    const word = (s: string): number => {
      // «حزمتان وإشارة واحدة» → 11
      let v = 0;
      if (/حزمة واحدة/.test(s)) v += 5; else if (/حزمتان/.test(s)) v += 10; else { const m = s.match(/(\d+) حزم/); if (m) v += 5 * Number(m[1]); }
      if (/إشارة واحدة/.test(s)) v += 1; else if (/إشارتان/.test(s)) v += 2; else { const m = s.match(/(\d+) إشارات/); if (m) v += Number(m[1]); }
      return v;
    };
    let rows = 0;
    for (const item of draws(t.id)) {
      const p = item.promptAr!;
      const m = [...p.matchAll(/([^\s:،]+): ([^،.]+)/g)].filter(x => /حزم|إشار/.test(x[2]!));
      if (m.length < 3) continue;
      rows += 1;
      const v = m.map(x => word(x[2]!));
      for (const x of v) assert.ok(x >= 1 && x <= 19, p);
      if (/الأكثر/.test(p)) assert.equal(item.answer, m[v.indexOf(Math.max(...v))]![1], p);
      else if (/الأقل/.test(p)) assert.equal(item.answer, m[v.indexOf(Math.min(...v))]![1], p);
      else if (/جميعًا|الكلي/.test(p)) assert.equal(Number(item.answer), v.reduce((a, b) => a + b, 0), p);
      else { const name = m.find(x => p.includes(`يفضّل ${x[1]}`) || p.endsWith(`${x[1]}؟`)); assert.ok(name, p); assert.equal(Number(item.answer), word(name[2]!), p); }
    }
    assert.ok(rows > 50, `only ${rows} tally tables`);
  });

  it('counts of one or two hundreds or tens are never «1 مئات» or «2 عشرات»', () => {
    for (const id of ['hundreds_a', 'hundreds_b']) {
      for (const item of draws(id)) assert.doesNotMatch(item.promptAr!, /(?:^|\s)[12] (?:مئات|عشرات|آحاد)/, item.promptAr);
    }
    for (const item of draws('thousands', 3)) assert.doesNotMatch(item.promptAr!, /(?:^|\s)[12] (?:آلاف|مئات|عشرات|آحاد)/, item.promptAr);
  });

  it('an eraser is shorter than the pencil beside it', () => {
    for (const item of draws('cm_lengths')) {
      const m = item.promptAr!.match(/قلم طوله (\d+) سم وممحاة طولها (\d+) سم/);
      if (m) assert.ok(Number(m[2]) < Number(m[1]) && Number(m[2]) <= 8, item.promptAr);
    }
  });
});
