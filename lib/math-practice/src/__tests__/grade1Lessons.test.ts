/**
 * The two Grade 1 maths lessons that had no offline questions (Grade 1 audit,
 * 2026-11-14): «خطة حل المسألة: التخمين والتحقق» (S2 u6_l4, closing the unit
 * on adding within two places) and «مهارة حل المسألة: اختيار العملية» (S2
 * u7_l4, closing the subtraction unit). Grade 1 adds and subtracts without
 * regrouping, and knows only those two operations. Every answer is recomputed
 * here from the numbers printed in its stem.
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
  return Array.from({ length: n }, (_, i) => makeTopicItem(t, 1, TIERS[i % 3]!, new Set(), seeded(i * 7919 + 1)));
}
const nums = (s: string) => (s.match(/[0-9]+/g) ?? []).map(Number);
const pairOf = (s: string) => s.split(' و ').map(Number) as [number, number];
/** Grade 1 adds and subtracts with nothing to regroup. */
const noCarry = (a: number, b: number) => (a % 10) + (b % 10) <= 9;
const noBorrow = (a: number, b: number) => a % 10 >= b % 10;

const TITLES = {
  guess_check_g1: 'خُطَّةُ حَلِّ الْمَسْأَلَةِ: التَّخْمينُ وَالتَّحَقُّقُ',
  choose_op_g1: 'مَهارَةُ حَلِّ الْمَسْأَلَةِ: اخْتِيارُ الْعَمَلِيَّةِ',
};

describe('Grade 1 maths lessons that had no offline questions', () => {
  for (const [id, title] of Object.entries(TITLES)) {
    it(`«${title}» reaches ${id} in Grade 1 only`, () => {
      assert.equal(topicFor(title, 1)?.id, id);
      for (const g of [2, 3]) assert.notEqual(topicFor(title, g)?.id, id, `grade ${g}`);
      assert.deepEqual(elementaryOpsForTitle(title), []);
      assert.ok(mathBankCovers(title, null, 1));
      assert.ok(takeElementaryMath('short_answer', title, null, 1, 'medium', 'ar', 2), 'an item comes back');
    });
  }

  it('every option is distinct from the answer and no number passes 99', () => {
    for (const id of Object.keys(TITLES)) for (const item of draws(id)) {
      const p = item.promptAr!;
      assert.equal(item.wrongs.length, 3, `${id}: ${p}`);
      assert.equal(new Set(item.wrongs).size, 3, `${id}: ${p}`);
      assert.ok(!item.wrongs.includes(item.answer), `${id}: ${p}`);
      for (const n of [...nums(p), ...nums([item.answer, ...item.wrongs].join(' '))]) assert.ok(n >= 0 && n <= 99, `${id}: ${n} in ${p}`);
    }
  });

  it('guess and check: which two make a total, two numbers from their sum and difference, a number added to itself', () => {
    const kinds = new Set<string>();
    for (const item of draws('guess_check_g1')) {
      const p = item.promptAr!;
      assert.equal(item.wrongs.length, 3, p);
      const m = p.match(/أي عددين من الأعداد (.+) مجموعهما ([0-9]+)؟/);
      if (m) {
        kinds.add('which-two');
        const list = nums(m[1]!), T = Number(m[2]);
        assert.equal(list.length, 4, p);
        const fits: string[] = [];
        for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (list[i]! + list[j]! === T) fits.push([list[i]!, list[j]!].sort((x, y) => x - y).join(' و '));
        assert.deepEqual(fits, [item.answer], `exactly one pair makes ${T}: ${p}`);
        const [a, b] = pairOf(item.answer);
        assert.ok(noCarry(a, b), `no regrouping: ${p}`);
        continue;
      }
      if (p.includes('والفرق بينهما')) {
        kinds.add('sum-difference');
        const [S, D] = nums(p), [a, b] = pairOf(item.answer);
        assert.ok(S! <= 20, `within 20: ${p}`);
        assert.equal(a + b, S, p);
        assert.equal(b - a, D, p);
        assert.ok(a > 0 && a < b, p);
        for (const w of item.wrongs) { const [x, y] = pairOf(w); assert.ok(x + y !== S || y - x !== D, `a wrong pair fits: ${w} — ${p}`); }
        continue;
      }
      assert.ok(p.includes('مع نفسه'), `unrecognised stem: ${p}`);
      kinds.add('double');
      assert.equal(2 * Number(item.answer), nums(p)[0], p);
    }
    assert.deepEqual([...kinds].sort(), ['double', 'sum-difference', 'which-two']);
  });

  it('choosing the operation: joining and putting together add, taking away and comparing subtract', () => {
    const kinds = new Set<string>();
    for (const item of draws('choose_op_g1')) {
      const p = item.promptAr!, [x, y] = nums(p) as [number, number];
      const story = p.includes('وأعطتها جدتها') ? 'join' : p.includes('وصعد إليها') ? 'put-together' : p.includes('أنفقت منها') ? 'take-away' : p.includes('بكم تزيد') ? 'compare' : null;
      assert.ok(story, `unrecognised story: ${p}`);
      kinds.add(story);
      const add = story === 'join' || story === 'put-together';
      assert.ok(x >= 10 && y >= 10, `two-digit numbers: ${p}`);
      assert.ok(add ? noCarry(x, y) && x + y <= 99 : noBorrow(x, y) && x > y, `no regrouping: ${p}`);
      assert.equal(item.wrongs.length, 3, p);
      if (p.startsWith('أي جملة عددية')) {
        // Grade 1 knows two operations: the choice is a number sentence, and the other operation is a wrong one
        kinds.add('name');
        assert.equal(item.answer, add ? `${x} + ${y} = ${x + y}` : `${x} − ${y} = ${x - y}`, p);
        assert.ok(item.wrongs.includes(add ? `${Math.max(x, y)} − ${Math.min(x, y)} = ${Math.abs(x - y)}` : `${x} + ${y} = ${x + y}`), `the other operation is an option: ${p}`);
        for (const w of item.wrongs) assert.ok(!/-/.test(w), `no negative: ${w}`);
        continue;
      }
      kinds.add('solve');
      assert.equal(Number(item.answer), add ? x + y : x - y, p);
      // the other operation on the same two numbers is the slip the lesson is about
      const other = add ? x - y : x + y;
      if (other > 0 && other <= 99) assert.ok(item.wrongs.includes(String(other)), `the other operation is an option: ${p}`);
    }
    assert.deepEqual([...kinds].sort(), ['compare', 'join', 'name', 'put-together', 'solve', 'take-away']);
  });
});
