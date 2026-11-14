/**
 * The four Grade 2 maths lessons that had no offline questions (Grade 2 audit,
 * 2026-11-14): «خطة حل المسألة: التخمين والتحقق» (S1 u3_l7, the addition
 * unit), «… الحل بأكثر من خطوة» (S1 u4_l7, the subtraction unit), «… البحث عن
 * نمط» (S2 u6_l8, the multiplication unit) and «مهارة حل المسألة: اختيار
 * العملية» (S2 u7_l8, the division unit). Every answer is recomputed here from
 * the numbers printed in its own stem, by code that shares nothing with the
 * generators.
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
  return Array.from({ length: n }, (_, i) => makeTopicItem(t, 2, TIERS[i % 3]!, new Set(), seeded(i * 7919 + 202)));
}
const nums = (s: string) => (s.match(/[0-9]+/g) ?? []).map(Number);
const pairOf = (s: string) => s.split(' و ').map(Number) as [number, number];

const TITLES = {
  guess_check_g2: 'خُطَّةُ حَلِّ الْمَسْأَلَةِ: التَّخْمينُ وَالتَّحَقُّقُ',
  multi_step_g2: 'خُطَّةُ حَلِّ الْمَسْأَلَةِ: الْحَلُّ بِأَكْثَرَ مِنْ خُطْوَةٍ',
  find_pattern_g2: 'خُطَّةُ حَلِّ الْمَسْأَلَةِ: الْبَحْثُ عَنْ نَمَطٍ',
  choose_op_g2: 'مَهارَةُ حَلِّ الْمَسْأَلَةِ: اخْتِيارُ الْعَمَلِيَّة',
};

describe('Grade 2 maths lessons that had no offline questions', () => {
  for (const [id, title] of Object.entries(TITLES)) {
    it(`«${title}» reaches its own generator`, () => {
      assert.equal(topicFor(title, 2)?.id, id);
      assert.ok(mathBankCovers(title, null, 2), 'covered');
      const q = takeElementaryMath('short_answer', title, null, 2, 'medium', 'ar', 2);
      assert.ok(q && q.text && q.answer, 'an item comes back');
    });
    it(`«${title}» is Grade 2's generator, not another grade's`, () => {
      for (const g of [1, 3, 4]) assert.notEqual(topicFor(title, g)?.id, id, `grade ${g}`);
    });
  }

  it('every item has three distinct wrong options, none the answer, and stays within Grade 2 numbers', () => {
    for (const id of Object.keys(TITLES)) for (const item of draws(id)) {
      const p = item.promptAr!;
      assert.equal(item.wrongs.length, 3, `${id}: ${p}`);
      assert.equal(new Set(item.wrongs).size, 3, `${id}: ${p}`);
      assert.ok(!item.wrongs.includes(item.answer), `${id}: ${p}`);
      // Grade 2 counts to 999, in whole numbers
      for (const n of nums(p)) assert.ok(n <= 999, `${id}: ${n} in ${p}`);
      for (const w of [item.answer, ...item.wrongs]) {
        assert.ok(!/[0-9]\.[0-9]/.test(w), `${id}: a decimal «${w}» in ${p}`);
        for (const n of nums(w)) assert.ok(n > 0 && n <= 999, `${id}: an option ${w} in ${p}`);
      }
    }
  });

  it('guess and check: two numbers from their sum and difference, which two make a total, a number added to itself', () => {
    const kinds = new Set<string>();
    for (const item of draws('guess_check_g2')) {
      const p = item.promptAr!;
      if (p.includes('والفرق بينهما')) {
        kinds.add('sum-difference');
        const [S, D] = nums(p), [a, b] = pairOf(item.answer);
        assert.equal(a + b, S, p);
        assert.equal(b - a, D, p);
        assert.ok(a > 0 && a < b, p);
        for (const w of item.wrongs) { const [x, y] = pairOf(w); assert.ok(x + y !== S || y - x !== D, `a wrong pair fits: ${w} — ${p}`); }
        continue;
      }
      const m = p.match(/أي عددين من الأعداد (.+) مجموعهما ([0-9]+)؟/);
      if (m) {
        kinds.add('which-two');
        const list = nums(m[1]!), T = Number(m[2]);
        assert.equal(list.length, 4, p);
        const fits: string[] = [];
        for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (list[i]! + list[j]! === T) fits.push([list[i]!, list[j]!].sort((x, y) => x - y).join(' و '));
        assert.deepEqual(fits, [item.answer], `exactly one pair makes ${T}: ${p}`);
        continue;
      }
      assert.ok(p.includes('مع نفسه'), `unrecognised stem: ${p}`);
      kinds.add('double');
      assert.equal(2 * Number(item.answer), nums(p)[0], p);
    }
    assert.deepEqual([...kinds].sort(), ['double', 'sum-difference', 'which-two']);
  });

  it('more than one step: money after a gift and a purchase, a bus, pages read together', () => {
    const kinds = new Set<string>();
    for (const item of draws('multi_step_g2')) {
      const p = item.promptAr!, n = nums(p), got = Number(item.answer);
      if (p.includes('أكثر منه')) {
        // «قرأ سامي A صفحة، وقرأ خالد B صفحة أكثر منه. كم صفحة قرأ الاثنان معًا؟» = A + (A + B)
        kinds.add('pages');
        assert.equal(n.length, 2, p);
        const [A, B] = n as [number, number];
        assert.equal(got, A + A + B, p);
        assert.ok(item.wrongs.includes(String(A + B)), `Khaled's pages alone (one step) is an option: ${p}`);
        continue;
      }
      assert.equal(n.length, 3, p);
      const [A, B, C] = n as [number, number, number];
      if (p.includes('قرشًا بقي')) { kinds.add('money'); assert.equal(got, A + B - C, p); }
      else { assert.ok(p.includes('حافلة'), `unrecognised stem: ${p}`); kinds.add('bus'); assert.equal(got, A - B + C, p); }
      // the child who stops after the first step is offered that number
      assert.ok(item.wrongs.includes(String(p.includes('حافلة') ? A - B : A + B)), `the first step alone is an option: ${p}`);
    }
    assert.deepEqual([...kinds].sort(), ['bus', 'money', 'pages']);
  });

  it('looking for a pattern: the next number, a missing one, and boxes of pens continued', () => {
    const kinds = new Set<string>();
    for (const item of draws('find_pattern_g2')) {
      const p = item.promptAr!;
      const m = p.match(/في النمط: (.+)؟/);
      if (m) {
        const cells = m[1]!.split('، ');
        assert.equal(cells.length, 5, p);
        const known = cells.map((c, i) => [i, c] as const).filter(([, c]) => c !== '___').map(([i, c]) => [i, Number(c)] as const);
        const step = (known[1]![1] - known[0]![1]) / (known[1]![0] - known[0]![0]);
        assert.ok([2, 3, 4, 5, 10].includes(step), `a times-table step: ${p}`);
        for (const [i, v] of known) assert.equal(v, known[0]![1] + step * (i - known[0]![0]), p);
        const gap = cells.indexOf('___');
        kinds.add(gap === 4 ? 'next' : 'missing');
        assert.equal(Number(item.answer), known[0]![1] + step * (gap - known[0]![0]), p);
        continue;
      }
      const b = p.match(/كم قلمًا في ([0-9]+) صناديق؟/);
      assert.ok(b, `unrecognised stem: ${p}`);
      kinds.add('boxes');
      const per = nums(p)[0]!, n = Number(b[1]);
      assert.ok(n >= 4 && n <= 10, p);
      assert.equal(Number(item.answer), per * n, p);
    }
    assert.deepEqual([...kinds].sort(), ['boxes', 'missing', 'next']);
  });

  it('choosing the operation: name it, or solve with it; the other operations are the wrong options', () => {
    const OPS = ['الجمع', 'الطرح', 'الضرب', 'القسمة'];
    const kinds = new Set<string>();
    for (const item of draws('choose_op_g2')) {
      const p = item.promptAr!;
      const [x, y] = nums(p) as [number, number];
      const op = p.includes('ثم وُضع فيها') ? 'الجمع' : p.includes('أُكل منها') ? 'الطرح' : p.includes('في كل صندوق') ? 'الضرب' : p.includes('بالتساوي') ? 'القسمة' : null;
      assert.ok(op, `unrecognised story: ${p}`);
      kinds.add(op);
      if (p.startsWith('أي عملية')) {
        kinds.add('name');
        assert.equal(item.answer, op, p);
        assert.deepEqual([...item.wrongs].sort(), OPS.filter(o => o !== op).sort(), p);
        continue;
      }
      kinds.add('solve');
      const r = op === 'الجمع' ? x + y : op === 'الطرح' ? x - y : op === 'الضرب' ? x * y : x / y;
      assert.ok(Number.isInteger(r) && r > 0, p);
      assert.equal(Number(item.answer), r, p);
      if (op === 'القسمة') assert.ok(x / y <= 10 && [2, 3, 4, 5, 10].includes(y), `a Grade 2 division fact: ${p}`);
      if (op === 'الضرب') assert.ok([2, 3, 4, 5, 10].includes(y) && x <= 10, `a Grade 2 table: ${p}`);
    }
    assert.deepEqual([...kinds].sort(), ['name', 'solve', ...OPS].sort());
  });
});
