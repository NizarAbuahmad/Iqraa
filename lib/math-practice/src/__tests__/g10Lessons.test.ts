/**
 * The five Grade 10 lessons that used to refuse with NoQuestionBankError
 * (`g10.ts`). Every key is recomputed here from the printed stem by a route
 * that shares no code with the generator: polynomials are parsed back out of
 * the Arabic stem and solved numerically, trig values come from Math.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TOPICS, makeTopicItem, topicFor } from '../topics.ts';
import { mathBankCovers, matchMathFamily, type ConcreteItem, type DiffTier } from '../index.ts';

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
  const t = TOPICS.find(x => x.id === id)!;
  return Array.from({ length: n }, (_, i) => makeTopicItem(t, 10, TIERS[i % 3]!, new Set(), seeded(i * 7919 + 13)));
}

const SUPS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const fromSup = (s: string) => Number([...s].map(c => SUPS.indexOf(c)).join(''));
const num = (s: string) => Number(s.replace(/−/g, '-'));

/** «2x³ − x + 5» → coefficients, highest power first. */
function parsePoly(src: string): number[] {
  const terms = src.replace(/\s+/g, '').replace(/−/g, '-').match(/[+-]?[^+-]+/g) ?? [];
  const byDeg = new Map<number, number>();
  for (const t of terms) {
    const m = t.match(/^([+-]?)(\d*)(x?)([⁰¹²³⁴⁵⁶⁷⁸⁹]*)$/);
    assert.ok(m, `cannot parse term «${t}» of «${src}»`);
    const hasX = m[3] === 'x';
    const deg = hasX ? (m[4] ? fromSup(m[4]) : 1) : 0;
    const mag = m[2] === '' ? 1 : Number(m[2]);
    byDeg.set(deg, (byDeg.get(deg) ?? 0) + (m[1] === '-' ? -mag : mag));
  }
  const n = Math.max(...byDeg.keys());
  return Array.from({ length: n + 1 }, (_, i) => byDeg.get(n - i) ?? 0);
}
const at = (c: number[], x: number) => c.reduce((a, k) => a * x + k, 0);
const mul = (a: number[], b: number[]) => {
  const o = new Array<number>(a.length + b.length - 1).fill(0);
  a.forEach((x, i) => b.forEach((y, j) => { o[i + j]! += x * y; }));
  return o;
};

/** Distinct real roots by Durand–Kerner, rounded. */
function realRoots(c: number[]): number[] {
  const lead = c[0]!;
  const p = c.map(k => k / lead);
  const n = p.length - 1;
  let re = Array.from({ length: n }, (_, i) => Math.cos(0.4 + (2 * Math.PI * i) / n) * 3);
  let im = Array.from({ length: n }, (_, i) => Math.sin(0.4 + (2 * Math.PI * i) / n) * 3);
  const ev = (x: number, y: number): [number, number] => {
    let a = 0, b = 0;
    for (const k of p) { const na = a * x - b * y + k, nb = a * y + b * x; a = na; b = nb; }
    return [a, b];
  };
  for (let it = 0; it < 2000; it++) {
    const nr = re.slice(), ni = im.slice();
    for (let i = 0; i < n; i++) {
      let dr = 1, di = 0;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const xr = nr[i]! - nr[j]!, xi = ni[i]! - ni[j]!;
        [dr, di] = [dr * xr - di * xi, dr * xi + di * xr];
      }
      const [vr, vi] = ev(nr[i]!, ni[i]!);
      const den = dr * dr + di * di || 1e-30;
      nr[i] = nr[i]! - (vr * dr + vi * di) / den;
      ni[i] = ni[i]! - (vi * dr - vr * di) / den;
    }
    re = nr; im = ni;
  }
  const out = new Set<number>();
  re.forEach((r, i) => { if (Math.abs(im[i]!) < 1e-4) out.add(Math.round(r * 1e4) / 1e4); });
  return [...out].sort((a, b) => a - b);
}
const listOf = (s: string) => s.split(' ، ').map(num);
const fracVal = (s: string) => { const [a, b] = s.replace(/−/g, '-').split('/'); return Number(a) / Number(b ?? 1); };

describe('routing: the five lessons are generated, not refused', () => {
  // «حل معادلات خاصة» is generated in g10.ts; the other four in grade10.ts (tested there).
  const cases: Array<[string, string]> = [
    ['حل معادلات خاصة', 'special_eq'],
    ['تمثيل الاقترانات المثلثية', 'g10_trig_graphs'],
    ['حل مسائل ثلاثية الأبعاد', 'g10_3d'],
    ['اقترانات كثيرات الحدود', 'g10_polynomials'],
    ['الاقترانات النسبية', 'g10_rational'],
    // the teacher guide's name for the same lesson, still in saved materials
    ['قسمة كثيرات الحدود والاقترانات النسبية', 'g10_rational'],
  ];
  for (const [title, id] of cases) {
    it(`${title} → ${id}, Grade 10 only`, () => {
      assert.equal(topicFor(title, 10)?.id, id);
      assert.ok(mathBankCovers(title, null, 10));
      assert.equal(topicFor(title, 9)?.id === id, false, 'no other grade is served these');
      // they have no banked family, so no worked example is claimed for them
      assert.equal(matchMathFamily(title, null), null);
    });
  }
  it('a lesson still without a generator keeps refusing', () => {
    assert.equal(mathBankCovers('المصفوفات', null, 10), false);
  });
});

describe('«حل معادلات خاصة»', () => {
  it('every key is the complete set of real roots of the printed equation', () => {
    const kinds = new Set<string>();
    for (const item of draws('special_eq')) {
      const p = item.promptAr!;
      if (p.startsWith('أوجد جميع الجذور')) {
        kinds.add('roots');
        const c = parsePoly(p.split(': ')[1]!.replace(/ = 0$/, ''));
        assert.deepEqual(listOf(item.answer), realRoots(c), p);
        for (const w of item.wrongs) assert.notDeepEqual(listOf(w), realRoots(c), `a wrong option is right: ${p}`);
      } else if (p.startsWith('ما الجذر الحقيقي')) {
        kinds.add('cube');
        const c = parsePoly(p.match(/للمعادلة (.+) = 0/)![1]!);
        const r = realRoots(c);
        assert.equal(r.length, 1, p);
        assert.ok(Math.abs(fracVal(item.answer) - r[0]!) < 1e-3, `${p} → ${item.answer}`);
      } else if (p.startsWith('كم جذرًا')) {
        kinds.add('count');
        assert.equal(Number(item.answer), realRoots(parsePoly(p.match(/للمعادلة: (.+) = 0/)![1]!)).length, p);
      } else {
        kinds.add('box');
        const [a, b] = p.match(/بمقدار (\d+) سم/g)!.map(s => Number(s.match(/\d+/)![0]));
        const V = Number(p.match(/حجمه (\d+)/)![1]);
        const h = Number(item.answer);
        assert.equal(h * (h - a!) * (h - b!), V, p);
        assert.ok(h > Math.max(a!, b!), p);
        for (const w of item.wrongs) assert.notEqual(Number(w) * (Number(w) - a!) * (Number(w) - b!) === V && Number(w) > Math.max(a!, b!), true, `wrong option ${w} solves ${p}`);
      }
    }
    assert.equal(kinds.size, 4, [...kinds].join());
  });
});
