/**
 * The four Grade 3 maths lessons that had no offline questions (audit,
 * 2026-11-14): «الأرقام الهندية» (S1 u1_l7), «خطة حل المسألة: التخمين والتحقق»
 * (S2 u7_l6), «مهارة حل المسألة: استعمال الخطوات الأربع» (S2 u8_l6, the meaning
 * of the remainder, pp. 36-37) and «الكسور والقسمة» (S2 u9_l8, a unit fraction
 * of a two-digit number by division). Every answer is recomputed here from the
 * numbers printed in its own stem, by code that shares nothing with the
 * generator.
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
  return Array.from({ length: n }, (_, i) => makeTopicItem(t, 3, TIERS[i % 3]!, new Set(), seeded(i * 7919 + 101)));
}
const HINDI = '٠١٢٣٤٥٦٧٨٩';
const fromHindi = (s: string) => Number([...s].map(c => HINDI.indexOf(c)).join(''));
/** Latin numbers in a stem (Hindi digits are not \d to this regex, by design). */
const nums = (s: string) => (s.match(/[0-9]+/g) ?? []).map(Number);

const TITLES = {
  hindi_numerals: 'الأَرْقامُ الهِنْدِيَّةُ',
  guess_check: 'خُطَّةُ حَلِّ المَسْأَلَةِ: التَّخْمينُ وَالتَّحَقُّقُ',
  four_steps: 'مَهارَةُ حَلِّ المَسْأَلَةِ: اسْتِعْمالُ الخُطُواتِ الأَرْبَعِ',
  frac_div: 'الكُسورُ وَالقِسْمَةُ',
};

describe('Grade 3 maths lessons that had no offline questions', () => {
  for (const [id, title] of Object.entries(TITLES)) {
    it(`«${title}» reaches its own generator`, () => {
      assert.equal(topicFor(title, 3)?.id, id);
      assert.ok(mathBankCovers(title, null, 3), 'covered');
      const q = takeElementaryMath('short_answer', title, null, 3, 'medium', 'ar', 2);
      assert.ok(q && q.text && q.answer, 'an item comes back');
    });
    it(`«${title}» is Grade 3's generator, not another grade's`, () => {
      for (const g of [2, 4, 5]) assert.notEqual(topicFor(title, g)?.id, id, `grade ${g}`);
    });
  }

  it('every item has three distinct wrong options, none the answer', () => {
    for (const id of Object.keys(TITLES)) for (const item of draws(id)) {
      assert.equal(item.wrongs.length, 3, `${id}: ${item.promptAr}`);
      assert.equal(new Set(item.wrongs).size, 3, `${id}: ${item.promptAr}`);
      assert.ok(!item.wrongs.includes(item.answer), `${id}: ${item.promptAr}`);
      // Grade 3 works in whole numbers: no option is a decimal
      for (const w of [item.answer, ...item.wrongs]) assert.ok(!/[0-9]\.[0-9]/.test(w), `${id}: a decimal «${w}» in ${item.promptAr}`);
    }
  });

  it('Hindi numerals: read numbers up to the thousands — greatest, smallest, a digit\'s value, the digit in a place', () => {
    const PLACE: Record<string, number> = { 'الآحاد': 1, 'العشرات': 10, 'المئات': 100, 'الألوف': 1000 };
    const kinds = new Set<string>();
    for (const item of draws('hindi_numerals')) {
      const p = item.promptAr!;
      // the stem carries its numbers in Hindi digits only, so it must be read, not copied
      assert.ok(!/[0-9]/.test(p), `a Latin digit in the stem: ${p}`);
      let m = p.match(/ما (أكبر|أصغر) عدد بين الأعداد الآتية: (.+)\؟/);
      if (m) {
        kinds.add(m[1] === 'أكبر' ? 'greatest' : 'smallest');
        const listed = m[2]!.split('، ').map(fromHindi);
        assert.equal(listed.length, 4, p);
        assert.ok(listed.every(v => v <= 9999), p);
        assert.equal(fromHindi(item.answer), m[1] === 'أكبر' ? Math.max(...listed) : Math.min(...listed), p);
        continue;
      }
      m = p.match(/ما قيمة الرقم ([٠-٩]) في العدد ([٠-٩]+)\؟/);
      if (m) {
        kinds.add('value');
        const d = fromHindi(m[1]!), n = fromHindi(m[2]!);
        assert.equal([...String(n)].filter(c => Number(c) === d).length, 1, `the digit appears once, so the question has one answer: ${p}`);
        const place = [1, 10, 100, 1000].find(q => Math.floor(n / q) % 10 === d && Number(item.answer) === d * q);
        assert.ok(place !== undefined, `${item.answer} is not the value of ${d} in ${n}: ${p}`);
        continue;
      }
      m = p.match(/ما الرقم الذي في منزلة (\S+) في العدد ([٠-٩]+)\؟/);
      assert.ok(m, `unrecognised stem: ${p}`);
      kinds.add('place');
      const n = fromHindi(m[2]!), q = PLACE[m[1]!]!;
      assert.equal(item.answer, HINDI[Math.floor(n / q) % 10], p);
    }
    assert.deepEqual([...kinds].sort(), ['greatest', 'place', 'smallest', 'value']);
  });

  it('guess and check: two numbers from their sum and product, legs, a purchase, a number times itself', () => {
    const kinds = new Set<string>();
    for (const item of draws('guess_check')) {
      const p = item.promptAr!, n = nums(p);
      if (p.includes('مجموعهما')) {
        kinds.add('sum-product');
        const [a, b] = item.answer.split(' و ').map(Number);
        assert.equal(a! + b!, n[0], p);
        assert.equal(a! * b!, n[1], p);
        assert.ok(a! <= b!, p);
        continue;
      }
      if (p.includes('أرجل')) {
        kinds.add('legs');
        const [heads, legs] = n;
        const sheep = Number(item.answer);
        assert.equal(4 * sheep + 2 * (heads! - sheep), legs, p);
        assert.ok(sheep > 0 && sheep < heads!, p);
        continue;
      }
      if (p.includes('في نفسه')) { kinds.add('square'); assert.equal(Number(item.answer) ** 2, n[0], p); continue; }
      assert.ok(p.includes('دفاتر'), `unrecognised stem: ${p}`);
      kinds.add('purchase');
      // «أقلامًا ثمن الواحد a… ودفاتر ثمن الواحد b… فاشترت N قطع/قطعة ودفعت T»
      const [a, b, N, T] = n;
      const notebooks = Number(item.answer);
      assert.equal(a! * (N! - notebooks) + b! * notebooks, T, p);
      assert.ok(notebooks > 0 && notebooks < N!, p);
    }
    assert.deepEqual([...kinds].sort(), ['legs', 'purchase', 'square', 'sum-product']);
  });

  it('the four steps: round the quotient up, down, or give the remainder, as the question asks (book p. 36-37)', () => {
    const kinds = new Set<string>();
    for (const item of draws('four_steps')) {
      // the total is two-digit (20-99) and the group size one-digit, in whichever order the stem names them
      const p = item.promptAr!, [x, y] = nums(p), N = Math.max(x!, y!), k = Math.min(x!, y!);
      const got = Number(item.answer);
      assert.ok(N! % k! !== 0, `the division leaves a remainder: ${p}`);
      if (p.includes('اللازمة') || p.includes('يجب') || p.includes('تحتاج')) {
        kinds.add('up');
        assert.equal(got, Math.ceil(N! / k!), p);
        assert.ok(item.wrongs.includes(String(Math.floor(N! / k!))), `dropping the remainder is offered: ${p}`);
        continue;
      }
      if (p.includes('يبقى')) { kinds.add('remainder'); assert.equal(got, N! % k!, p); continue; }
      assert.ok(p.includes('أكبر عدد'), `unrecognised stem: ${p}`);
      kinds.add('down');
      assert.equal(got, Math.floor(N! / k!), p);
      assert.ok(item.wrongs.includes(String(Math.ceil(N! / k!))), `rounding up is offered: ${p}`);
    }
    assert.deepEqual([...kinds].sort(), ['down', 'remainder', 'up']);
  });

  it('fractions and division: a unit fraction of a two-digit number, by dividing', () => {
    const kinds = new Set<string>();
    for (const item of draws('frac_div')) {
      const p = item.promptAr!;
      const m = p.match(/1\/([0-9]+)/);
      assert.ok(m, `a unit fraction: ${p}`);
      const d = Number(m[1]);
      const N = nums(p.replace(/1\/[0-9]+/g, ''))[0]!;
      assert.ok(N >= 10 && N <= 99 && N % d === 0, `a two-digit number with no remainder: ${p}`);
      if (p.includes('جملة القسمة')) { kinds.add('sentence'); assert.equal(item.answer, `${N} ÷ ${d}`, p); continue; }
      kinds.add(p.includes('ما 1/') ? 'bare' : 'story');
      assert.equal(Number(item.answer), N / d, p);
    }
    assert.deepEqual([...kinds].sort(), ['bare', 'sentence', 'story']);
  });
});
