/**
 * Topic generators (`../topics.ts`). The key must never be typed: every
 * generator is checked by recomputing its answer from the numbers in its own
 * stem, by a route that does not share code with the generator.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TOPICS, makeTopicItem, topicFor } from '../topics.ts';
import { mathBankCovers, takeElementaryMath, type DiffTier } from '../index.ts';
import type { ConcreteItem } from '../index.ts';

const TIERS: DiffTier[] = ['easy', 'medium', 'hard'];

/** mulberry32 — a seeded rng so a failure names a reproducible draw. */
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

const topic = (id: string) => TOPICS.find(t => t.id === id)!;
function draws(id: string, n = 150): Array<{ item: ConcreteItem; grade: number; diff: DiffTier }> {
  const t = topic(id);
  const out: Array<{ item: ConcreteItem; grade: number; diff: DiffTier }> = [];
  for (let i = 0; i < n; i++) {
    const grade = t.grades[0] + (i % (t.grades[1] - t.grades[0] + 1));
    const diff = TIERS[i % 3]!;
    out.push({ item: makeTopicItem(t, grade, diff, new Set(), seeded(i * 7919 + 13)), grade, diff });
  }
  return out;
}

const nums = (s: string) => (s.match(/\d+/g) ?? []).map(Number);
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const toJs = (eq: string) => eq.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/(\d+)²/g, '($1**2)');
const num = (s: string) => Number(s.replace('−', '-'));

/** Value of «−3/4», «3 2/5», «35%», «0.75», «12»; null for anything else. */
function value(s: string): number | null {
  const t = s.trim().replace('−', '-');
  let m = t.match(/^(-?\d+) (\d+)\/(\d+)$/);
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = t.match(/^(-?\d+)\/(\d+)$/);
  if (m) return Number(m[1]) / Number(m[2]);
  m = t.match(/^(-?\d+(?:\.\d+)?)%$/);
  if (m) return Number(m[1]) / 100;
  m = t.match(/^-?\d+(?:\.\d+)?$/);
  return m ? Number(t) : null;
}

describe('every generator, every grade, every tier', () => {
  for (const t of TOPICS) {
    it(`${t.id}: well-formed items with three distinct wrong options`, () => {
      for (const { item, grade, diff } of draws(t.id, 240)) {
        const where = `${t.id} g${grade} ${diff} «${item.promptAr}» → ${item.answer} | ${item.wrongs.join(' | ')}`;
        assert.ok(item.answer.length > 0 && item.promptAr && item.promptEn, where);
        // a comparison sign has only two other signs to be confused with
        const sign = /^[<>=]$/.test(item.answer);
        assert.equal(item.wrongs.length, sign ? 2 : 3, where);
        assert.equal(new Set([item.answer, ...item.wrongs]).size, sign ? 3 : 4, `options not distinct: ${where}`);
        for (const s of [item.answer, ...item.wrongs, item.promptAr!, item.promptEn!, item.eq]) {
          assert.ok(!/NaN|undefined|Infinity|\[object/.test(s), `bad text: ${where}`);
          assert.ok(!/(^|[^\w])-\d/.test(s), `hyphen-minus instead of −: ${s}`);
        }
        assert.ok(item.wrongs.every(w => w.trim() === w && w.length > 0), where);
        // A wrong option that is the same VALUE as the answer is a second right answer.
        const a = value(item.answer);
        if (a !== null && t.id !== 'ratio') {
          for (const w of item.wrongs) {
            const v = value(w);
            if (v !== null) assert.ok(Math.abs(v - a) > 1e-9, `wrong «${w}» equals the answer: ${where}`);
          }
        }
      }
    });
  }
});

describe('answers recomputed from the stem', () => {
  it('rounding whole numbers', () => {
    for (const { item } of draws('round_whole')) {
      const [n] = nums(item.promptAr!);
      const place = item.promptAr!.includes('ألف') ? 1000 : item.promptAr!.includes('مئة') ? 100 : 10;
      assert.equal(Number(item.answer), Math.round(n! / place) * place, item.promptAr);
    }
  });

  it('rounding decimals', () => {
    for (const { item } of draws('round_dec')) {
      const shown = Number(item.eq);
      const places = item.promptAr!.includes('أعشار') ? 1 : 0;
      assert.equal(Number(item.answer), Math.round(shown * 10 ** places + 1e-9) / 10 ** places, item.promptAr);
    }
  });

  it('estimating a sum, difference, product and quotient', () => {
    const lead = (n: number) => { const p = 10 ** (String(n).length - 1); return Math.round(n / p) * p; };
    for (const { item } of [...draws('est_sum'), ...draws('est_add'), ...draws('est_sub')]) {
      const [a, b] = nums(item.eq);
      assert.equal(Number(item.answer), item.eq.includes('+') ? lead(a!) + lead(b!) : lead(a!) - lead(b!), item.eq);
    }
    for (const { item } of draws('est_prod')) {
      const [a, b] = nums(item.eq);
      assert.equal(Number(item.answer), lead(a!) * lead(b!), item.eq);
    }
    for (const { item } of draws('est_quot')) {
      const [n, d] = nums(item.eq);
      const unit = item.promptAr!.includes('مئة') ? 100 : 10;
      assert.equal(Number(item.answer), (Math.round(n! / unit) * unit) / d!, item.eq);
    }
    for (const { item } of draws('est_sum_dec')) {
      const [a, b] = item.eq.split(/ [+−] /).map(Number);
      assert.equal(Number(item.answer), item.eq.includes('+') ? Math.round(a!) + Math.round(b!) : Math.round(a!) - Math.round(b!), item.eq);
    }
  });

  it('an estimation lesson named for one operation asks only that one', () => {
    assert.ok(draws('est_add').every(({ item }) => item.eq.includes('+')));
    assert.ok(draws('est_sub').every(({ item }) => item.eq.includes('−')));
  });

  it('multiples of ten', () => {
    for (const { item } of [...draws('tens_mul'), ...draws('tens_div')]) {
      const js = Function(`return ${toJs(item.eq)}`)() as number;
      assert.equal(Number(item.answer), js, item.eq);
    }
  });

  it('factors, primes, gcf, lcm', () => {
    const divs = (n: number) => Array.from({ length: n }, (_, i) => i + 1).filter(i => n % i === 0);
    for (const { item } of draws('factors')) {
      const n = Number(item.eq);
      const ans = Number(item.answer);
      if (item.promptAr!.startsWith('كم')) assert.equal(ans, divs(n).length);
      else { assert.equal(n % ans, 0); assert.ok(ans < n); assert.ok(divs(n).filter(d => d < n).every(d => d <= ans)); }
    }
    for (const { item } of draws('primes')) {
      const lo = Number(item.eq), p = Number(item.answer);
      assert.equal(divs(p).length, 2, `${p} is not prime`);
      assert.ok(p > lo);
      for (let k = lo + 1; k < p; k++) assert.notEqual(divs(k).length, 2, `${k} is prime and smaller than ${p}`);
      for (const w of item.wrongs) assert.notEqual(divs(Number(w)).length, 2, `wrong ${w} is prime`);
    }
    for (const { item } of draws('gcf')) {
      const [a, b] = nums(item.eq);
      assert.equal(Number(item.answer), gcd(a!, b!));
    }
    for (const { item } of draws('lcm')) {
      const [a, b] = nums(item.eq);
      const m = Array.from({ length: a! * b! }, (_, i) => i + 1).find(x => x % a! === 0 && x % b! === 0)!;
      assert.equal(Number(item.answer), m);
    }
  });

  it('divisibility: the digit works and is the smallest/largest that does', () => {
    for (const { item } of draws('divisibility', 300)) {
      const d = Number(item.promptAr!.match(/على (\d+)/)![1]);
      const largest = item.promptAr!.includes('أكبر');
      const ok: number[] = [];
      for (let v = item.eq.startsWith('■') ? 1 : 0; v <= 9; v++) if (Number(item.eq.replace('■', String(v))) % d === 0) ok.push(v);
      assert.ok(ok.length > 0 && ok.length < 10, item.eq);
      assert.equal(Number(item.answer), largest ? Math.max(...ok) : Math.min(...ok), `${item.eq} ÷ ${d}`);
    }
  });

  it('prime factorisation', () => {
    for (const { item } of draws('prime_fact')) {
      const f = item.answer.split(' × ').map(Number);
      assert.equal(f.reduce((a, b) => a * b, 1), Number(item.eq));
      for (const p of f) for (let k = 2; k < p; k++) assert.notEqual(p % k, 0, `${p} is not prime`);
      assert.deepEqual(f, [...f].sort((a, b) => a - b));
    }
  });

  it('squares, cubes, roots, powers', () => {
    for (const { item } of [...draws('squares'), ...draws('powers')]) {
      if (item.eq.startsWith('√')) assert.equal(Number(item.answer) ** 2, Number(item.eq.slice(1)));
      else if (item.eq.startsWith('∛')) assert.equal(Number(item.answer) ** 3, Number(item.eq.slice(1)));
      else if (/^\d+³$/.test(item.eq)) assert.equal(Number(item.answer), Number(item.eq.slice(0, -1)) ** 3);
      else if (/^\d+²$/.test(item.eq)) assert.equal(Number(item.answer), Number(item.eq.slice(0, -1)) ** 2);
      else if (item.eq.includes('×')) {
        const f = item.eq.split(' × ').map(Number);
        const base = f[0]!;
        assert.ok(f.every(x => x === base));
        assert.equal(item.answer.startsWith(String(base)), true);
        const sup = '⁰¹²³⁴⁵⁶⁷⁸⁹';
        const e = Number([...item.answer.slice(String(base).length)].map(c => sup.indexOf(c)).join(''));
        assert.equal(e, f.length);
      } else {
        const m = item.eq.match(/^(\d+)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/)!;
        const sup = '⁰¹²³⁴⁵⁶⁷⁸⁹';
        const e = Number([...m[2]!].map(c => sup.indexOf(c)).join(''));
        assert.equal(Number(item.answer), Number(m[1]) ** e);
      }
    }
  });

  it('order of operations: JS precedence agrees, and the usual slips are among the wrong options', () => {
    for (const { item } of draws('order_ops', 300)) {
      const js = Function(`return ${toJs(item.eq)}`)() as number;
      assert.equal(Number(item.answer), js, item.eq);
      assert.ok(Number.isInteger(js) && js >= 0, item.eq);
      // at least one slip (left-to-right or ignoring brackets) must be offered
      const noParens = Function(`return ${toJs(item.eq.replace(/[()]/g, ''))}`)() as number;
      if (noParens !== js && noParens >= 0) assert.ok(item.wrongs.includes(String(noParens)), `${item.eq}: ignoring brackets gives ${noParens}`);
    }
  });

  it('integers', () => {
    for (const { item } of [...draws('int_add'), ...draws('int_sub'), ...draws('int_muldiv')]) {
      const js = Function(`return ${toJs(item.eq)}`)() as number;
      assert.equal(num(item.answer), js, item.eq);
    }
    for (const { item } of draws('int_abs')) {
      const m = item.eq.match(/^\|(.+)\|$/);
      if (m) assert.equal(Number(item.answer), Math.abs(num(m[1]!)));
      else assert.equal(num(item.answer), -num(item.eq));
    }
    for (const { item } of draws('int_compare')) {
      const xs = item.eq.split(' ، ').map(num);
      if (item.promptAr!.includes('أصغر')) assert.equal(num(item.answer), Math.min(...xs));
      else assert.deepEqual(item.answer.split(' ، ').map(num), [...xs].sort((a, b) => a - b));
    }
    for (const { item } of draws('int_intro')) {
      if (item.eq.includes('___')) {
        const [a, b] = item.eq.split(' ___ ').map(num);
        assert.equal(item.answer, a! < b! ? '<' : '>');
      }
    }
  });

  it('equivalent fractions and ratios', () => {
    for (const { item } of draws('equiv_frac')) {
      const m = item.eq.match(/^(\d+)\/(\d+) = \?\/(\d+)$/)!;
      assert.equal(Number(item.answer) / Number(m[3]), Number(m[1]) / Number(m[2]));
    }
    for (const { item } of draws('ratio_equiv')) {
      const [a, b, c] = nums(item.eq);
      assert.equal(a! * Number(item.answer), b! * c!);
    }
    for (const { item } of draws('ratio')) {
      const [a, b] = nums(item.eq), [x, y] = nums(item.answer);
      assert.equal(a! * y!, b! * x!);
      assert.equal(gcd(x!, y!), 1);
    }
  });

  it('mixed and improper fractions', () => {
    for (const { item } of draws('mixed_improper')) {
      assert.ok(Math.abs(value(item.eq)! - value(item.answer)!) < 1e-9, `${item.eq} = ${item.answer}`);
    }
  });

  it('mixed-number operations', () => {
    for (const t of ['mixed_addsub', 'mixed_mul', 'mixed_div']) {
      for (const { item } of draws(t)) {
        const m = item.eq.match(/^(\d+) (\d+)\/(\d+) ([+−×÷]) (\d+) (\d+)\/(\d+)$/)!;
        const A = Number(m[1]) + Number(m[2]) / Number(m[3]), B = Number(m[5]) + Number(m[6]) / Number(m[7]);
        const want = m[4] === '+' ? A + B : m[4] === '−' ? A - B : m[4] === '×' ? A * B : A / B;
        assert.ok(Math.abs(value(item.answer)! - want) < 1e-9, `${item.eq} = ${item.answer} (want ${want})`);
        assert.ok(want > 0, item.eq);
        // lowest terms
        const f = item.answer.match(/(\d+)\/(\d+)$/);
        if (f) assert.equal(gcd(Number(f[1]), Number(f[2])), 1, item.answer);
      }
    }
  });

  it('fractions, decimals and percents', () => {
    for (const { item } of [...draws('frac_dec', 300), ...draws('pct_conv')]) {
      const a = value(item.eq), b = value(item.answer);
      assert.ok(a !== null && b !== null, `${item.eq} → ${item.answer}`);
      assert.ok(Math.abs(a! - b!) < 1e-9, `${item.eq} ≠ ${item.answer}`);
    }
    for (const { item } of draws('dec_place')) {
      const digit = Number(item.promptAr!.match(/رقم (\d)/)![1]);
      const idx = item.eq.indexOf('.') + 1;
      const pos = [...item.eq.slice(idx)].findIndex((c, i) => Number(c) === digit && Math.abs(Number(item.answer) - digit / 10 ** (i + 1)) < 1e-12);
      assert.ok(pos >= 0, `${item.eq}: place value of ${digit} is not ${item.answer}`);
    }
  });

  it('rational numbers', () => {
    for (const { item } of draws('rat_compare')) {
      const [l, r] = item.eq.split(' ___ ').map(value);
      assert.equal(item.answer, l! < r! ? '<' : '>');
    }
    for (const t of ['rat_addsub', 'rat_muldiv']) {
      for (const { item } of draws(t, 300)) {
        const m = item.eq.match(/^\(?(−?\d+)\/(\d+)\)? ([+−×÷]) \(?(−?\d+)\/(\d+)\)?$/)!;
        const A = num(m[1]!) / Number(m[2]), B = num(m[4]!) / Number(m[5]);
        const want = m[3] === '+' ? A + B : m[3] === '−' ? A - B : m[3] === '×' ? A * B : A / B;
        assert.ok(Math.abs(value(item.answer)! - want) < 1e-9, `${item.eq} = ${item.answer} (want ${want})`);
        const f = item.answer.match(/^−?(\d+)\/(\d+)$/);
        if (f) assert.equal(gcd(Number(f[1]), Number(f[2])), 1, item.answer);
      }
    }
    for (const { item } of draws('repeating')) {
      const [n, d] = nums(item.eq);
      // the answer's digits must be the cycle of n/d: long-divide and look for it
      let r = n!;
      const digits: string[] = [];
      for (let i = 0; i < 60; i++) { r *= 10; digits.push(String(Math.floor(r / d!))); r %= d!; }
      const s = digits.join('');
      assert.ok(s.includes(item.answer.repeat(3)), `${item.eq}: ${item.answer} is not the repeating block of ${s}`);
    }
  });

  it('exponent laws', () => {
    const sup = '⁰¹²³⁴⁵⁶⁷⁸⁹';
    const ex = (s: string) => Number([...s].map(c => sup.indexOf(c)).filter(i => i >= 0).join('') || '1');
    for (const { item } of draws('exp_laws', 300)) {
      let m = item.eq.match(/^x([⁰¹²³⁴⁵⁶⁷⁸⁹]+) × x([⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/);
      if (m) { const e = ex(m[1]!) + ex(m[2]!); assert.equal(item.answer, `x${[...String(e)].map(c => sup[Number(c)]).join('')}`); continue; }
      m = item.eq.match(/^x([⁰¹²³⁴⁵⁶⁷⁸⁹]+) ÷ x([⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/);
      if (m) { const e = ex(m[1]!) - ex(m[2]!); assert.equal(item.answer, e === 1 ? 'x' : `x${[...String(e)].map(c => sup[Number(c)]).join('')}`); continue; }
      m = item.eq.match(/^\(x([⁰¹²³⁴⁵⁶⁷⁸⁹]+)\)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/);
      if (m) { const e = ex(m[1]!) * ex(m[2]!); assert.equal(item.answer, `x${[...String(e)].map(c => sup[Number(c)]).join('')}`); continue; }
      if (/⁰$/.test(item.eq)) { assert.equal(item.answer, '1'); continue; }
      m = item.eq.match(/^(\d+)⁻([⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/);
      if (m) { assert.equal(item.answer, `1/${Number(m[1]) ** ex(m[2]!)}`); continue; }
      m = item.eq.match(/^\((\d+)x\)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/);
      if (m) { assert.equal(item.answer, `${Number(m[1]) ** ex(m[2]!)}x${m[2]}`); continue; }
      assert.fail(`unrecognised exponent-law stem ${item.eq}`);
    }
  });
});

describe('routing', () => {
  const cases: Array<[string, number, string | null]> = [
    ['العوامل', 4, 'factors'],
    ['الأعداد الأولية، والأعداد غير الأولية', 4, 'primes'],
    ['قابلية القسمة على 2, 3, 5, 10', 4, 'divisibility'],
    ['تقريب الأعداد', 4, 'round_whole'],
    ['تقريب الأعداد العشرية', 4, 'round_dec'],
    ['تقدير المجموع والفرق', 4, 'est_sum'],
    ['تقدير ناتج الجمع', 3, 'est_add'],
    ['تقدير ناتج الطرح', 3, 'est_sub'],
    ['تقدير نواتج جمع الأعداد العشرية وطرحها', 5, 'est_sum_dec'],
    ['العامل المشترك الأكبر', 5, 'gcf'],
    ['القوى والأسس', 6, 'powers'],
    ['أولويات العمليات الحسابية', 7, 'order_ops'],
    ['جمع الأعداد الصحيحة', 6, 'int_add'],
    ['جمع الأعداد الكسرية وطرحها', 6, 'mixed_addsub'],
    ['النسبة المئوية والكسور العادية', 6, 'pct_conv'],
    ['قوانين الأسس الصحيحة', 7, 'exp_laws'],
    // a title no generator is about, and a grade outside a generator's range
    ['خطة حل المسألة: الرسم', 7, null],
    ['العوامل', 8, null],
    ['الدوران', 7, null],
  ];
  for (const [title, grade, id] of cases) {
    it(`${title} (G${grade}) → ${id ?? 'refused'}`, () => {
      assert.equal(topicFor(title, grade)?.id ?? null, id);
      if (id) assert.ok(mathBankCovers(title, null, grade));
    });
  }

  it('serves every question type through the shared formatter', () => {
    for (const type of ['multiple_choice', 'true_false', 'fill_blank', 'short_answer', 'word_problem'] as const) {
      const q = takeElementaryMath(type, 'العامل المشترك الأكبر', null, 5, 'medium', 'ar', 2, new Set());
      assert.ok(q && q.text.length > 0, type);
      if (type === 'multiple_choice') assert.equal(q!.options!.length, 4);
    }
  });

  it('a lesson already served by the drills is still served by them', () => {
    const q = takeElementaryMath('short_answer', 'جمع الكسور', null, 5, 'easy', 'ar', 1, new Set());
    assert.ok(q);
    assert.ok(!/topic/.test(q!.text));
  });

  it('no stem repeats inside one pass while the generator has room', () => {
    const used = new Set<string>();
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const q = takeElementaryMath('short_answer', 'العامل المشترك الأكبر', null, 5, 'hard', 'ar', 1, used)!;
      assert.ok(!seen.has(q.text), q.text);
      seen.add(q.text);
    }
  });
});
