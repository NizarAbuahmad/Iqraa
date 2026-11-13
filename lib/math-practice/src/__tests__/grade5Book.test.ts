/**
 * Grade 5 maths, held to what the Grade 5 book (NCCD, 2025-26) actually asks.
 *
 * Found 2026-11-13 by running every Grade 5 lesson through `takeElementaryMath`:
 * every key was right, but «القيمة المنزلية ضمن الملايين» asked about 92 and
 * 399 (the book reads 9-digit numbers, p. 9-10), «ضرب الأعداد» asked
 * «10 + 10 + 10 = ؟ × 10» and «17 × 3» (the book: 252 × 8, 4698 × 6, 84 × 207,
 * p. 40), «قسمة الأعداد» asked «إذا كان 3 × 2 = 6، فما ناتج 6 ÷ 3؟», and
 * «الضرب الذهني» (doubling and halving, p. 30-33) and «المضلعات» (S2 p. 66-69)
 * got no questions at all.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { makeElementaryItem } from '../elementary.ts';
import { makeTopicItem, topicFor } from '../topics.ts';
import { itemStem, mathBankCovers, type ConcreteItem, type DiffTier } from '../index.ts';

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

const TIERS: DiffTier[] = ['easy', 'medium', 'hard'];

function elementaryDraws(title: string, count = 300): ConcreteItem[] {
  const rng = seeded(5 * 7919 + title.length);
  const out: ConcreteItem[] = [];
  let used = new Set<string>();
  for (let i = 0; i < count; i++) {
    if (i % 30 === 0) used = new Set();
    out.push(makeElementaryItem(title, 5, TIERS[i % 3]!, used, rng));
  }
  return out;
}

function topicDraws(title: string, count = 300): ConcreteItem[] {
  const t = topicFor(title, 5);
  assert.ok(t, `no Grade 5 generator for «${title}»`);
  return Array.from({ length: count }, (_, i) => makeTopicItem(t, 5, TIERS[i % 3]!, new Set(), seeded(i * 7919 + 17)));
}

/** Whole numbers in a stem, in reading order. */
const nums = (s: string) => (s.match(/\d+/g) ?? []).map(Number);
const biggest = (item: ConcreteItem) => Math.max(...nums(itemStem(item, true)), ...nums(item.answer));

describe('Grade 5 numbers are the size the book uses', () => {
  it('place value within millions reads six- to nine-digit numbers', () => {
    let millions = 0;
    for (const item of elementaryDraws('القِيمَةُ المَنْزِلِيَّةُ ضِمْنَ المَلايينِ')) {
      const n = biggest(item);
      assert.ok(n >= 100000, `too small for Grade 5: ${itemStem(item, true)} → ${item.answer}`);
      if (n >= 1000000) millions++;
    }
    assert.ok(millions >= 60, `only ${millions} of 300 items reach the millions`);
  });

  it('multiplying numbers is multi-digit, never repeated addition or a times-table fact', () => {
    for (const item of elementaryDraws('ضَرْبُ الأَعْدادِ')) {
      const stem = itemStem(item, true);
      assert.doesNotMatch(stem, /\+/, `repeated addition is Grade 2: ${stem}`);
      assert.ok(biggest(item) >= 100, `a times-table fact, not Grade 5: ${stem} → ${item.answer}`);
    }
  });

  it('dividing numbers has a dividend of three digits or more, and no fact family', () => {
    for (const item of elementaryDraws('قِسْمَةُ الأَعْدادِ')) {
      const stem = itemStem(item, true);
      assert.doesNotMatch(stem, /إذا كان .* × /, `a fact family is Grade 3: ${stem}`);
      assert.ok(biggest(item) >= 100, `too small for Grade 5: ${stem} → ${item.answer}`);
    }
  });
});

describe('Grade 5 lessons that had no questions', () => {
  it('mental multiplication: doubling, halving, and a product by doubling and halving', () => {
    assert.ok(mathBankCovers('الضَّرْبُ الذِّهْنِيُّ', null, 5));
    const kinds = new Set<string>();
    for (const item of topicDraws('الضَّرْبُ الذِّهْنِيُّ')) {
      const p = item.promptAr!;
      const ns = nums(p);
      const ans = Number(item.answer);
      if (/ضعف/.test(p)) { kinds.add('double'); assert.equal(ans, 2 * ns[0]!, p); }
      else if (/نصف/.test(p)) { kinds.add('half'); assert.equal(ans, ns[0]! / 2, p); assert.ok(Number.isInteger(ans), p); }
      else { kinds.add('product'); assert.equal(ans, ns[0]! * ns[1]!, p); }
      assert.equal(item.wrongs.length, 3, p);
      assert.ok(!item.wrongs.includes(item.answer), p);
    }
    assert.deepEqual([...kinds].sort(), ['double', 'half', 'product']);
  });

  it('polygons: the name from the sides, the vertices from the name, regular or not, a regular perimeter', () => {
    assert.ok(mathBankCovers('الْمُضَلَّعاتُ', null, 5));
    const NAMES: Record<string, number> = { 'مثلث': 3, 'رباعي': 4, 'خماسي': 5, 'سداسي': 6, 'سباعي': 7, 'ثماني': 8 };
    const kinds = new Set<string>();
    for (const item of topicDraws('الْمُضَلَّعاتُ')) {
      const p = item.promptAr!;
      const ns = nums(p);
      if (/ما اسمه/.test(p)) { kinds.add('name'); assert.equal(NAMES[item.answer], ns[0], p); }
      else if (/كم رأسًا/.test(p)) {
        kinds.add('vertices');
        const named = Object.keys(NAMES).find(k => p.includes(k))!;
        assert.equal(Number(item.answer), NAMES[named], p);
      }
      else if (/أيّ المضلعات الآتية/.test(p)) { kinds.add('regular'); assert.ok(p.includes(item.answer), p); }
      else if (/محيطه/.test(p) && /طول ضلعه/.test(p)) {
        kinds.add('perimeter');
        const named = Object.keys(NAMES).find(k => p.includes(k))!;
        if (/ما محيطه/.test(p)) assert.equal(Number(item.answer), NAMES[named]! * ns[0]!, p);
        else assert.equal(Number(item.answer) * NAMES[named]!, ns[0], p);
      }
      else assert.fail(`unknown kind: ${p}`);
      assert.equal(item.wrongs.length, 3, p);
      assert.ok(!item.wrongs.includes(item.answer), p);
    }
    assert.deepEqual([...kinds].sort(), ['name', 'perimeter', 'regular', 'vertices']);
  });

  it('regular or not: a square and an equilateral triangle are regular; a rectangle and a rhombus are not', () => {
    const REGULAR = new Set(['مربع', 'مثلث متساوي الأضلاع', 'خماسي منتظم', 'سداسي منتظم', 'ثماني منتظم']);
    const IRREGULAR = new Set(['مستطيل', 'معين', 'مثلث متساوي الساقين', 'شبه منحرف', 'مثلث قائم الزاوية', 'متوازي أضلاع']);
    let seen = 0;
    for (const item of topicDraws('الْمُضَلَّعاتُ', 600)) {
      const p = item.promptAr!;
      if (!/أيّ المضلعات الآتية/.test(p)) continue;
      seen++;
      const listed = p.slice(p.indexOf(':') + 1).replace(/؟$/, '').split(' ، ').map(s => s.trim());
      assert.equal(listed.length, 4, p);
      for (const s of listed) assert.ok(REGULAR.has(s) || IRREGULAR.has(s), `unclassified «${s}»: ${p}`);
      const wantRegular = !/غير منتظم/.test(p);
      const right = listed.filter(s => REGULAR.has(s) === wantRegular);
      assert.deepEqual(right, [item.answer], `exactly one listed shape answers: ${p}`);
      assert.deepEqual([...item.wrongs].sort(), listed.filter(s => s !== item.answer).sort(), p);
    }
    assert.ok(seen > 50, `${seen} regular-or-not items`);
  });
});
