/**
 * Grade 3 second pass (review, 2026-11-20): the generators were run over every
 * Grade 3 maths lesson and each quiz was read against its objective. Every key
 * was right; these are the places where a question did not fit the lesson.
 *
 * - «العد القفزي» counts «بالعشرات والمئات والألوف»; it skipped by 3, 7, 25…
 * - «مقارنة الأعداد» / «ترتيب الأعداد» are «ضمن 4 منازل»; they showed 91 and 392.
 * - «مقارنة الكسور» / «ترتيب الكسور» compare «باستعمال النماذج وخط الأعداد»; they
 *   asked 6/7 against 5/8, which needs a common denominator (Grade 5).
 * - The conversion lessons gave 18000 m and options like 4860000; Grade 3
 *   numbers stay within the thousands («ضمن الألوف»).
 * - «الضرب في 6 و9», «الضرب في 7 و8» only ever drilled the first table.
 * - «ما 1/6 العدد 30» lacked its «من».
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TOPICS, makeTopicItem } from '../topics.ts';
import { makeElementaryItem } from '../elementary.ts';
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
function draws(id: string, grade = 3, n = 400): ConcreteItem[] {
  const t = TOPICS.find(x => x.id === id);
  assert.ok(t, `no generator ${id}`);
  return Array.from({ length: n }, (_, i) => makeTopicItem(t, grade, TIERS[i % 3]!, new Set(), seeded(i * 7919 + 17)));
}
const lesson = (title: string, grade = 3, n = 300) =>
  Array.from({ length: n }, (_, i) => makeElementaryItem(title, grade, TIERS[i % 3]!, new Set(), seeded(i * 104729 + 3)));
const nums = (s: string) => (s.match(/\d+/g) ?? []).map(Number);
const all = (i: ConcreteItem) => `${i.promptAr ?? i.eq} ${i.answer} ${i.wrongs.join(' ')}`;

describe('Grade 3 second pass (review, 2026-11-20)', () => {
  it('«العد القفزي» skips by tens, hundreds or thousands, from any number, within 9999', () => {
    const steps = new Set<number>();
    for (const item of draws('skip_g3')) {
      const p = item.promptAr!;
      const jump = p.match(/طول كل قفزة (\d+)/)?.[1];
      const seq = p.includes('مقدار القفزة') || p.includes('أكمل العدّ') ? nums(p) : [];
      const s = jump ? Number(jump) : p.includes('مقدار القفزة') ? Number(item.answer) : Math.abs(seq[1]! - seq[0]!) || Math.abs(seq[seq.length - 1]! - seq[seq.length - 2]!);
      assert.ok([10, 100, 1000].includes(s), `step ${s}: ${p}`);
      steps.add(s);
      for (const n of nums(all(item))) assert.ok(n <= 9999, `past 9999: ${all(item)}`);
    }
    assert.deepEqual([...steps].sort((a, b) => a - b), [10, 100, 1000]);
    // not only multiples of the step: «3427، 3437، 3447» is the book's kind of count
    assert.ok(draws('skip_g3').some(i => /أكمل العدّ/.test(i.promptAr!) && nums(i.promptAr!).some(n => n % 10 !== 0)));
  });

  it('…and Grade 1 still counts by 2, 5 and 10', () => {
    for (const item of draws('skip_g1', 1)) assert.ok(nums(item.promptAr!).every(n => n <= 100), item.promptAr);
  });

  it('comparing and ordering at Grade 3 use four-digit numbers', () => {
    for (const title of ['مقارنة الأعداد', 'ترتيب الأعداد']) {
      for (const item of lesson(title)) {
        for (const n of nums(item.promptAr ?? item.eq)) {
          // «ما أكبر عدد يمكن تكوينه من الأرقام 2، 9، 3، 4» lists digits
          if (/الأرقام/.test(item.promptAr ?? '')) continue;
          assert.ok(n >= 1000 && n <= 9999, `${title}: ${item.promptAr}`);
        }
      }
    }
  });

  it('comparing fractions at Grade 3: same denominator or same numerator only', () => {
    for (const title of ['مقارنة الكسور', 'ترتيب الكسور']) {
      for (const item of lesson(title)) {
        const fr = [...(item.promptAr ?? item.eq).matchAll(/(\d+)\/(\d+)/g)].map(m => [Number(m[1]), Number(m[2])]);
        if (fr.length < 2) continue;
        const sameD = fr.every(f => f[1] === fr[0]![1]), sameN = fr.every(f => f[0] === fr[0]![0]);
        assert.ok(sameD || sameN, `${title}: ${item.promptAr}`);
        for (const [n, d] of fr) assert.ok(d! <= 12 && n! < d!, `a proper fraction: ${item.promptAr}`);
      }
    }
  });

  it('…while Grade 5 still compares unlike fractions', () => {
    assert.ok(lesson('مقارنة الكسور', 5).some(i => {
      const fr = [...(i.promptAr ?? i.eq).matchAll(/(\d+)\/(\d+)/g)].map(m => [Number(m[1]), Number(m[2])]);
      return fr.length === 2 && fr[0]![0] !== fr[1]![0] && fr[0]![1] !== fr[1]![1];
    }));
  });

  it('the conversion lessons stay within 9999 — answers and options', () => {
    for (const id of ['units_m', 'units_km', 'units_mass', 'units_volume']) {
      for (const item of draws(id)) for (const n of nums(all(item))) assert.ok(n <= 9999, `${id}: ${all(item)}`);
    }
  });

  it('«الضرب في 6 و9» and «الضرب في 7 و8» drill both of their tables', () => {
    for (const [title, x, y] of [['الضرب في 6 و9', 6, 9], ['الضرب في 7 و8', 7, 8]] as const) {
      const seen = new Set<number>();
      for (const item of lesson(title)) {
        // the repeated-addition kind always adds the lesson's own table: «9 + 9 + 9 = ؟ × 9»
        const m = (item.promptAr ?? item.eq).match(/(\d+) \+ \1 \+/);
        if (m) seen.add(Number(m[1]));
      }
      assert.deepEqual([...seen].sort(), [x, y].sort(), title);
    }
  });

  it('«الكسور والقسمة» asks for a unit fraction «من» a number', () => {
    for (const item of draws('frac_div')) assert.doesNotMatch(item.promptAr!, /1\/\d+ العدد/, item.promptAr);
  });
});
