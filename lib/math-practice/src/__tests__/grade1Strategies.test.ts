/**
 * Grade 1's four strategy lessons (Grade 1 audit, 2026-11-14). Each catalog
 * objective names a strategy — «جمع عددين بالإكمال إلى العدد 10», «جمع ثلاثة
 * أعداد بإيجاد مكونات العدد 10 أولًا», «طرح عددين مستعملًا الضعف», «طرح عددين
 * ضمن العدد 20 بإيجاد عشرة» — but the lessons were served the generic «جمع/طرح»
 * drill, which used the strategy in 9, 72, 20 and 8 items of 360. Every answer
 * here is recomputed from the numbers printed in its stem.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TOPICS, makeTopicItem, topicFor } from '../topics.ts';
import { elementaryOpsForTitle, mathBankCovers, takeElementaryMath, type ConcreteItem, type DiffTier } from '../index.ts';

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
function draws(id: string, n = 300): ConcreteItem[] {
  const t = TOPICS.find(x => x.id === id);
  assert.ok(t, `no generator ${id}`);
  return Array.from({ length: n }, (_, i) => makeTopicItem(t, 1, TIERS[i % 3]!, new Set(), seeded(i * 7919 + 11)));
}
const nums = (s: string) => (s.match(/[0-9]+/g) ?? []).map(Number);

const TITLES = {
  make_ten_add: 'الْجَمْعُ بِالْإِكْمالِ إِلى الْعَشَرَةِ',
  three_addends: 'جَمْعُ ثَلاثَةِ أَعْدادٍ',
  sub_doubles: 'الطَّرْحُ بِاسْتِعْمالِ الضِّعْفِ',
  sub_make_ten: 'الطَّرْحُ بِإيجادِ عَشَرَةٍ',
};

describe('Grade 1 strategy lessons', () => {
  for (const [id, title] of Object.entries(TITLES)) {
    it(`«${title}» reaches ${id}, not the «جمع/طرح» drill, and only in Grade 1`, () => {
      assert.equal(topicFor(title, 1)?.id, id);
      for (const g of [2, 3]) assert.notEqual(topicFor(title, g)?.id, id, `grade ${g}`);
      assert.deepEqual(elementaryOpsForTitle(title), []);
      assert.ok(mathBankCovers(title, null, 1));
      const used = new Set<string>();
      for (let i = 0; i < 12; i++) assert.ok(takeElementaryMath('short_answer', title, null, 1, TIERS[i % 3]!, 'ar', 2, used), 'an item comes back');
    });
  }

  it('every item has three distinct wrong options, none the answer, all within 20', () => {
    for (const id of Object.keys(TITLES)) for (const item of draws(id)) {
      const p = item.promptAr!;
      assert.equal(item.wrongs.length, 3, `${id}: ${p}`);
      assert.equal(new Set(item.wrongs).size, 3, `${id}: ${p}`);
      assert.ok(!item.wrongs.includes(item.answer), `${id}: ${p}`);
      for (const n of nums(p)) assert.ok(n <= 20, `${id}: ${n} in ${p}`);
    }
  });

  it('adding by making ten: two one-digit numbers whose sum passes 10, and the two steps', () => {
    const kinds = new Set<string>();
    for (const item of draws('make_ten_add')) {
      const p = item.promptAr!, m = p.match(/([0-9]+) \+ ([0-9]+)/)!;
      assert.ok(m, p);
      const a = Number(m[1]), b = Number(m[2]);
      assert.ok(a < 10 && b < 10 && a + b > 10, `the sum crosses ten: ${p}`);
      if (/\+ ___ = 10/.test(p)) { kinds.add('to ten'); assert.equal(Number(item.answer), 10 - a, p); }
      else if (/= 10 \+ ___/.test(p)) { kinds.add('what is left'); assert.equal(Number(item.answer), a + b - 10, p); }
      else { kinds.add('sum'); assert.equal(Number(item.answer), a + b, p); }
    }
    assert.deepEqual([...kinds].sort(), ['sum', 'to ten', 'what is left']);
  });

  it('adding three numbers: two of them make 10, and only those two', () => {
    const kinds = new Set<string>();
    for (const item of draws('three_addends')) {
      const p = item.promptAr!, n = nums(p);
      assert.equal(n.length, p.includes('مجموعهما 10') ? 4 : 3, p);
      const [x, y, z] = n.filter((_, i) => !(p.includes('مجموعهما 10') && i === 0)) as [number, number, number];
      const tens = [[x, y], [x, z], [y, z]].filter(([u, v]) => u! + v! === 10);
      assert.equal(tens.length, 1, `exactly one pair makes 10: ${p}`);
      if (p.includes('مجموعهما 10')) { kinds.add('which two'); assert.equal(item.answer, [...tens[0]!].sort((u, v) => u! - v!).join(' و '), p); continue; }
      kinds.add(p.includes('كرة') ? 'story' : 'sum');
      assert.equal(Number(item.answer), x + y + z, p);
    }
    assert.deepEqual([...kinds].sort(), ['story', 'sum', 'which two']);
  });

  it('subtracting with a double: every difference is 2n − n', () => {
    for (const item of draws('sub_doubles')) {
      const p = item.promptAr!, m = p.match(/([0-9]+) − (?:[0-9]+|___)/)!;
      assert.ok(m, p);
      const a = Number(m[1]), n = a / 2;
      assert.ok(Number.isInteger(n) && n >= 2, `a double: ${p}`);
      assert.equal(Number(item.answer), n, p);
    }
  });

  it('subtracting by finding ten: a teen minus a one-digit number crossing ten, and the two steps', () => {
    const kinds = new Set<string>();
    for (const item of draws('sub_make_ten')) {
      const p = item.promptAr!, m = p.match(/([0-9]+) − ([0-9]+)/)!;
      assert.ok(m, p);
      const a = Number(m[1]), b = Number(m[2]);
      assert.ok(a > 10 && a < 20 && b < 10 && a - b < 10, `crosses ten: ${p}`);
      if (/− ___ = 10/.test(p)) { kinds.add('to ten'); assert.equal(Number(item.answer), a - 10, p); }
      else if (/= 10 − ___/.test(p)) { kinds.add('then'); assert.equal(Number(item.answer), b - (a - 10), p); }
      else { kinds.add('difference'); assert.equal(Number(item.answer), a - b, p); }
    }
    assert.deepEqual([...kinds].sort(), ['difference', 'then', 'to ten']);
  });
});

describe('two lengths are a dual (Grade 1 audit)', () => {
  it('«قيس طولا شيئين», never «قيست أطوال شيئين»', () => {
    const t = TOPICS.find(x => x.id === 'compare_len')!;
    let seen = false;
    for (let i = 0; i < 300; i++) {
      const p = makeTopicItem(t, 1, TIERS[i % 3]!, new Set(), seeded(i)).promptAr ?? '';
      assert.ok(!/أطوال شيئين/.test(p), p);
      if (/قيس طولا شيئين/.test(p)) seen = true;
    }
    assert.ok(seen);
  });
});
