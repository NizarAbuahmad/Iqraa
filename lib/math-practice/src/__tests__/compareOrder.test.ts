/**
 * «مقارنة الأعداد» and «ترتيب الأعداد» (Grades 1–3) each ask their own skill.
 *
 * Both lessons used to route to the one `compare` op, so a comparing paper asked
 * «رتّب الأعداد الآتية…» and an ordering paper asked «ضع الإشارة المناسبة» — the
 * same mix under two titles (Grade 3 review, 2026-11-13: «weak, not fixed»).
 * The combined lessons («مقارنة الأعداد وترتيبها», Grades 4–5, and Grade 7's
 * rational numbers) keep the mixed `compare` op.
 *
 * Every question must be answerable as a short answer, with no options shown,
 * so the numbers it is about are always in the stem; every key is recomputed.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { elementaryOpsForTitle, makeElementaryItem } from '../elementary.ts';
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
const nums = (s: string) => (s.match(/\d+/g) ?? []).map(Number);
const listOf = (s: string) => s.split('،').map(x => Number(x.trim()));
const stem = (i: ConcreteItem) => i.promptAr ?? i.wordAr ?? '';

// The titles as each grade's catalog prints them.
const COMPARE: Record<number, string> = { 1: 'مُقارَنَةُ الْأَعْدادِ', 2: 'مُقارَنَةُ الْأَعْدادِ', 3: 'مُقارَنَةُ الأَعْدادِ' };
const ORDER: Record<number, string> = { 1: 'تَرْتيبُ الْأَعْدادِ', 2: 'تَرْتيبُ الْأَعْدادِ', 3: 'تَرْتيبُ الأَعْدادِ' };
/** The numbers a grade's lessons name: G1 «ضمن منزلتين», G2 «ضمن 3 منازل», G3 «ضمن الألوف». */
const RANGE: Record<number, [number, number]> = { 1: [10, 99], 2: [100, 999], 3: [100, 9999] };

function draws(title: string, grade: number, n = 240): ConcreteItem[] {
  return Array.from({ length: n }, (_, i) => makeElementaryItem(title, grade, TIERS[i % 3]!, new Set(), seeded(i * 7919 + grade)));
}

/** The kind of a comparing question, with its key checked; throws on anything else. */
function compareKind(item: ConcreteItem): string {
  const p = stem(item);
  const m = p.match(/(\d+) ___ (\d+)/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    assert.equal(item.answer, a > b ? '>' : a < b ? '<' : '=', p);
    return 'sign';
  }
  const ex = p.match(/ما العدد (الأكبر|الأصغر) بين الأعداد الآتية: (.+)؟/);
  if (ex) {
    const vs = listOf(ex[2]!);
    assert.equal(Number(item.answer), ex[1] === 'الأكبر' ? Math.max(...vs) : Math.min(...vs), p);
    return 'extreme';
  }
  const than = p.match(/أيّ الأعداد الآتية (أكبر|أصغر) من (\d+): (.+)؟/);
  if (than) {
    const n = Number(than[2]);
    const vs = listOf(than[3]!);
    const fits = vs.filter(v => (than[1] === 'أكبر' ? v > n : v < n));
    assert.deepEqual(fits, [Number(item.answer)], `exactly one fits: ${p}`);
    return 'than';
  }
  throw new Error(`not a comparing question: ${p}`);
}

/** The kind of an ordering question, with its key checked; throws on anything else. */
function orderKind(item: ConcreteItem): string {
  const p = stem(item);
  const arr = p.match(/^رتّب الأعداد الآتية (تصاعديًّا|تنازليًّا): (.+)$/);
  if (arr) {
    const vs = listOf(arr[2]!);
    const want = [...vs].sort((x, y) => (arr[1] === 'تصاعديًّا' ? x - y : y - x));
    assert.deepEqual(listOf(item.answer), want, p);
    return 'arrange';
  }
  const pos = p.match(/رتّب الأعداد الآتية (تصاعديًّا|تنازليًّا)، ثم اكتب العدد الذي يأتي (ثانيًا|ثالثًا): (.+)$/);
  if (pos) {
    const vs = listOf(pos[3]!);
    const sorted = [...vs].sort((x, y) => (pos[1] === 'تصاعديًّا' ? x - y : y - x));
    assert.equal(Number(item.answer), sorted[pos[2] === 'ثانيًا' ? 1 : 2], p);
    return 'position';
  }
  // Grade 1's numbers have two places, so it builds one from two of three digits.
  const dg = p.match(/ما (أكبر|أصغر) عدد (من منزلتين )?يمكن تكوينه من الأرقام (.+)، إذا استُعمل كل رقم مرة واحدة(?: على الأكثر)?؟/);
  if (dg) {
    const ds = listOf(dg[3]!);
    const sorted = [...ds].sort((x, y) => (dg[1] === 'أكبر' ? y - x : x - y));
    assert.equal(item.answer, sorted.slice(0, dg[2] ? 2 : ds.length).join(''), p);
    return 'digits';
  }
  throw new Error(`not an ordering question: ${p}`);
}

describe('«مقارنة الأعداد» and «ترتيب الأعداد» ask their own skill (Grades 1–3)', () => {
  it('routes each lesson to its own op, and the combined lessons to the mixed one', () => {
    for (const g of [1, 2, 3]) {
      assert.deepEqual(elementaryOpsForTitle(COMPARE[g]!), ['compare_only'], COMPARE[g]);
      assert.deepEqual(elementaryOpsForTitle(ORDER[g]!), ['order_only'], ORDER[g]);
    }
    assert.deepEqual(elementaryOpsForTitle('مُقارَنَةُ الأَعْدادِ وَتَرْتيبُها'), ['compare']);
    assert.deepEqual(elementaryOpsForTitle('مقارنة الأعداد النسبية وترتيبها'), ['compare']);
  });

  for (const g of [1, 2, 3]) {
    it(`Grade ${g} «مقارنة الأعداد» compares and never orders`, () => {
      const kinds = new Map<string, number>();
      for (const item of draws(COMPARE[g]!, g)) {
        assert.ok(!/رتّب/.test(stem(item)), `orders: ${stem(item)}`);
        const k = compareKind(item);
        kinds.set(k, (kinds.get(k) ?? 0) + 1);
      }
      assert.deepEqual([...kinds.keys()].sort(), ['extreme', 'sign', 'than'], `Grade ${g}: ${[...kinds]}`);
      // Grades 1–4 then choose among drawn items by difficulty (earlyDifficulty.ts), so shares are uneven.
      for (const [k, c] of kinds) assert.ok(c >= 15, `Grade ${g}: ${k} only ${c} of 240`);
    });

    it(`Grade ${g} «ترتيب الأعداد» orders and never asks a sign or the greatest of a list`, () => {
      const kinds = new Map<string, number>();
      for (const item of draws(ORDER[g]!, g)) {
        assert.ok(!/___|العدد الأكبر بين|العدد الأصغر بين/.test(stem(item)), `compares: ${stem(item)}`);
        const k = orderKind(item);
        kinds.set(k, (kinds.get(k) ?? 0) + 1);
      }
      assert.deepEqual([...kinds.keys()].sort(), ['arrange', 'digits', 'position'], `Grade ${g}: ${[...kinds]}`);
      // Grades 1–4 then choose among drawn items by difficulty (earlyDifficulty.ts), so shares are uneven.
      for (const [k, c] of kinds) assert.ok(c >= 15, `Grade ${g}: ${k} only ${c} of 240`);
    });

    it(`Grade ${g} keeps the numbers its lessons name`, () => {
      const [lo, hi] = RANGE[g]!;
      for (const item of [...draws(COMPARE[g]!, g), ...draws(ORDER[g]!, g)]) {
        const p = stem(item);
        // the digits of a «أكبر عدد يمكن تكوينه» item are single digits by design
        const ns = /يمكن تكوينه/.test(p) ? [Number(item.answer)] : nums(p);
        for (const n of ns) assert.ok(n >= lo && n <= hi, `Grade ${g}: ${n} outside ${lo}–${hi}: ${p}`);
      }
    });

    it(`Grade ${g}: every question has three distinct wrong options`, () => {
      for (const item of [...draws(COMPARE[g]!, g), ...draws(ORDER[g]!, g)]) {
        if (/___/.test(stem(item))) { assert.equal(item.wrongs.length, 2, stem(item)); continue; } // > < = has three choices in all
        assert.equal(new Set(item.wrongs).size, 3, `${stem(item)} → ${item.wrongs}`);
        assert.ok(!item.wrongs.includes(item.answer), stem(item));
      }
    });
  }
});
