/**
 * The two Grade 4 maths lessons that had no offline questions (audit,
 * 2026-11-13): «خطة حل المسألة: الحل بأكثر من خطوة» (S1 pp. 44-45) and «خطة حل
 * المسألة: استعمال شكل ڤن» (S2 pp. 126-127). Every answer is recomputed here
 * from the numbers printed in its own stem, by code that shares nothing with
 * the generator.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TOPICS, makeTopicItem, topicFor } from '../topics.ts';
import { mathBankCovers, takeElementaryMath, type ConcreteItem, type DiffTier } from '../index.ts';

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
  return Array.from({ length: n }, (_, i) => makeTopicItem(t, 4, TIERS[i % 3]!, new Set(), seeded(i * 7919 + 101)));
}
const nums = (s: string) => (s.match(/\d+/g) ?? []).map(Number);

const TITLES = {
  multi_step: 'خُطَّةُ حَلِّ المَسْأَلَةِ: الحَلُّ بِأَكْثَرَ مِنْ خُطْوَةٍ',
  venn_plan: 'خُطَّةُ حَلِّ المَسْأَلَةِ: اسْتِعْمالُ شَكْلِ ڤِن',
};
/** Days in each month as the Jordanian calendar names them (no February: it has two lengths). */
const DAYS: Record<string, number> = {
  'كانون الثاني': 31, 'آذار': 31, 'نيسان': 30, 'أيار': 31, 'حزيران': 30, 'تموز': 31,
  'آب': 31, 'أيلول': 30, 'تشرين الأول': 31, 'تشرين الثاني': 30, 'كانون الأول': 31,
};
const MINUTES: Record<string, number> = { 'ساعة وربعًا': 75, 'ساعة ونصفًا': 90, 'ساعتين': 120, 'نصف ساعة': 30 };

describe('Grade 4 problem-solving lessons that had no offline questions', () => {
  for (const [id, title] of Object.entries(TITLES)) {
    it(`«${title}» reaches its own generator`, () => {
      assert.equal(topicFor(title, 4)?.id, id);
      assert.ok(mathBankCovers(title, null, 4), 'covered');
      const q = takeElementaryMath('short_answer', title, null, 4, 'medium', 'ar', 2);
      assert.ok(q && q.text && q.answer, 'an item comes back');
    });
    it(`«${title}» is Grade 4's only, not another grade's`, () => {
      for (const g of [3, 5, 6]) assert.notEqual(topicFor(title, g)?.id, id, `grade ${g}`);
    });
  }

  it('multi-step: two steps, each kind the book practises (p. 44-45)', () => {
    const kinds = new Set<string>();
    for (const item of draws('multi_step')) {
      const p = item.promptAr!;
      const got = Number(item.answer);
      assert.ok(Number.isInteger(got) && got > 0, `a whole count: ${p}`);
      const n = nums(p);
      let m = p.match(/في شهري (.+) و(.+)\؟/);
      if (m) {
        kinds.add('months');
        assert.ok(DAYS[m[1]!] && DAYS[m[2]!], `known months: ${p}`);
        assert.equal(got, n[0]! * (DAYS[m[1]!]! + DAYS[m[2]!]!), p);
        continue;
      }
      if (p.includes('في العام الواحد')) { kinds.add('year'); assert.equal(got, n[0]! * n[1]! * 52, p); continue; }
      if (p.includes('رفًّا')) { kinds.add('shelves'); assert.equal(got, (n[0]! + n[1]!) * n[2]!, p); continue; }
      m = p.match(/استغرقت (.+) لطباعة/);
      if (m) { kinds.add('typing'); assert.ok(MINUTES[m[1]!], p); assert.equal(got, n[0]! * MINUTES[m[1]!]!, p); continue; }
      assert.ok(p.includes('ألبوم'), `unrecognised stem: ${p}`);
      kinds.add('albums');
      assert.equal(got, n[0]! * n[1]! * n[2]!, p);
    }
    assert.deepEqual([...kinds].sort(), ['albums', 'months', 'shelves', 'typing', 'year']);
  });

  it('multi-step: stopping after the first step is always a wrong option', () => {
    for (const item of draws('multi_step')) {
      const p = item.promptAr!, n = nums(p);
      assert.equal(item.wrongs.length, 3, p);
      assert.ok(!item.wrongs.includes(item.answer), p);
      // what a pupil has after one step: one month, one week, one album, the shelf count, one hour
      const m = p.match(/في شهري (.+) و(.+)\؟/);
      const early = m ? [n[0]! * DAYS[m[1]!]!, n[0]! * DAYS[m[2]!]!, DAYS[m[1]!]! + DAYS[m[2]!]!]
        : p.includes('في العام الواحد') ? [n[0]! * n[1]!]
        : p.includes('رفًّا') ? [n[0]! + n[1]!, n[0]! * n[2]!]
        : p.includes('لطباعة') ? [n[0]! * 60]
        : [n[0]! * n[1]!];
      assert.ok(item.wrongs.some(w => early.includes(Number(w))), `no one-step wrong option: ${p} ${item.wrongs}`);
    }
  });

  it('Venn: total, one group only, or the other group, from two groups and their overlap (p. 126-127)', () => {
    const kinds = new Set<string>();
    for (const item of draws('venn_plan')) {
      const p = item.promptAr!;
      const got = Number(item.answer);
      assert.ok(Number.isInteger(got) && got > 0, `a whole count: ${p}`);
      const [a, b, c] = nums(p);
      if (p.includes('فقط؟')) { kinds.add('only'); assert.equal(got, a! - c!, p); continue; }
      if (p.includes('جميعهم')) {
        // «T in all, a like X, c like both»: how many like Y?
        kinds.add('other');
        const [T, x, both] = [a!, b!, c!];
        assert.equal(got, T - x + both, p);
        assert.ok(both < x && both < got, `the overlap is smaller than both groups: ${p}`);
        continue;
      }
      kinds.add('total');
      assert.ok(c! < a! && c! < b!, `the overlap is smaller than both groups: ${p}`);
      assert.equal(got, a! + b! - c!, p);
    }
    assert.deepEqual([...kinds].sort(), ['only', 'other', 'total']);
  });

  it('Venn: adding the two groups without taking the overlap off is a wrong option', () => {
    let offered = 0;
    for (const item of draws('venn_plan')) {
      const [a, b] = nums(item.promptAr!);
      if (item.wrongs.includes(String(a! + b!))) offered++;
    }
    assert.ok(offered > 50, `a + b was offered only ${offered} times`);
  });
});
