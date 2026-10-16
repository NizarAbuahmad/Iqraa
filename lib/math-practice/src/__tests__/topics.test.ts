/**
 * Topic generators (`../topics.ts`). The key must never be typed: every
 * generator is checked by recomputing its answer from the numbers in its own
 * stem, by a route that does not share code with the generator.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TOPICS, makeTopicItem, topicFor } from '../topics.ts';
import { ALGEBRA_TOPICS } from '../algebra.ts';
import { GEOMETRY_TOPICS } from '../geometry.ts';
import { STATS_TOPICS } from '../stats.ts';
import { PROPORTION_TOPICS } from '../proportion.ts';
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
  // algebra, geometry, stats and proportion have their own shape tests (some answers have fewer than three wrong options)
  const OWN = new Set([...ALGEBRA_TOPICS, ...GEOMETRY_TOPICS, ...STATS_TOPICS, ...PROPORTION_TOPICS].map(t => t.id));
  for (const t of TOPICS.filter(t => !OWN.has(t.id))) {
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

// Stem readers: everything below is recomputed from the printed Arabic stem.
const has = (p: string, s: string) => p.includes(s);
/** Signed integers in a stem: «−7 − (−3)» → [−7, −3] (a «−» followed by a space is an operator). */
const snums = (s: string) => (s.match(/−?\d+/g) ?? []).map(num);
/** Unsigned decimals in a stem: «8.99 + 1.91» → [8.99, 1.91]. */
const dnums = (s: string) => (s.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
/** The options a «which of these…» stem lists, after its last colon (or on its second line). */
const listOf = (p: string) => (p.includes('\n') ? p.split('\n')[1]! : p.slice(p.lastIndexOf(': ') + 2)).replace(/؟$/, '').split(' ، ');
/** A signed mixed number, fraction or integer: «−2 1/3» is −(2 + 1/3), unlike `value`. */
function sval(s: string): number {
  const m = s.trim().match(/^(−?)(\d+) (\d+)\/(\d+)$/);
  if (m) return (m[1] ? -1 : 1) * (Number(m[2]) + Number(m[3]) / Number(m[4]));
  return value(s)!;
}
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const lowest = (s: string) => { const f = s.match(/(\d+)\/(\d+)$/); if (f) assert.equal(gcd(Number(f[1]), Number(f[2])), 1, `${s} is not in lowest terms`); };
const divs = (n: number) => Array.from({ length: n }, (_, i) => i + 1).filter(i => n % i === 0);
const isPrime = (n: number) => divs(n).length === 2;
const SUPS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const fromSup = (s: string) => Number([...s].map(c => SUPS.indexOf(c)).join(''));
const toSup = (n: number) => [...String(n)].map(c => SUPS[Number(c)]).join('');
/** The order of operations as JS has it; «5²» is (5**2). */
const js = (expr: string) => Function(`return ${toJs(expr)}`)() as number;
/** The slip: every operation strictly from left to right. */
function leftToRight(expr: string): number {
  const t = expr.replace(/[()]/g, '').split(' ').map(x => (x.endsWith('²') ? Number(x.slice(0, -1)) ** 2 : x));
  let v = Number(t[0]);
  for (let i = 1; i < t.length; i += 2) {
    const r = Number(t[i + 1]);
    v = t[i] === '+' ? v + r : t[i] === '−' ? v - r : t[i] === '×' ? v * r : v / r;
  }
  return v;
}
/** The first `n` decimal digits of p/q (0 < p/q < 1). */
function expansion(p: number, q: number, n = 40): string {
  let r = p % q, out = '';
  for (let i = 0; i < n; i++) { r *= 10; out += String(Math.floor(r / q)); r %= q; }
  return out;
}
/** A printed repeating decimal «0.1666…» read the way a pupil reads it: the last block repeats for ever. */
function readRepeating(shown: string, n = 40): string {
  const D = shown.match(/^0\.(\d+)…$/)![1]!;
  for (let k = 1; k <= 6; k++) {
    const block = D.slice(-k);
    if (D.endsWith(block.repeat(k === 1 ? 3 : 2))) { let out = D; while (out.length < n) out += block; return out.slice(0, n); }
  }
  throw new Error(`no repeating block in ${shown}`);
}

describe('answers recomputed from the stem', () => {
  const PLACE: Array<[string, number]> = [['عشرة آلاف', 10000], ['ألف', 1000], ['مئة', 100], ['عشرة', 10]];
  const placeIn = (p: string) => PLACE.find(([w]) => has(p, `أقرب ${w}`))![1];
  const lead = (n: number) => { const p = 10 ** (String(n).length - 1); return Math.round(n / p) * p; };

  it('rounding whole numbers: round, the edges of a rounding interval, which number rounds to a value', () => {
    const kinds = new Set<string>();
    for (const { item } of draws('round_whole', 300)) {
      const p = item.promptAr!;
      const place = placeIn(p);
      const r = (n: number) => Math.round(n / place) * place;
      const [n] = nums(p);
      const ans = Number(item.answer);
      if (p.startsWith('قرّب')) { kinds.add('round'); assert.equal(ans, r(n!), p); }
      else if (has(p, 'ما أصغر عدد كلي')) { kinds.add('smallest'); assert.equal(r(ans), n, p); assert.notEqual(r(ans - 1), n, p); }
      else if (has(p, 'ما أكبر عدد كلي')) { kinds.add('largest'); assert.equal(r(ans), n, p); assert.notEqual(r(ans + 1), n, p); }
      else if (has(p, 'أيّ الأعداد')) {
        kinds.add('which');
        const opts = listOf(p);
        assert.deepEqual([...opts].sort(), [item.answer, ...item.wrongs].sort(), p);
        for (const o of opts) assert.equal(r(Number(o)) === n, o === item.answer, `${p}: ${o}`);
      } else assert.fail(`unknown stem: ${p}`);
    }
    assert.equal(kinds.size, 4, [...kinds].join());
  });

  it('rounding decimals: to a whole number, tenth or hundredth; a measurement; which number rounds to a whole', () => {
    const kinds = new Set<string>();
    for (const { item } of draws('round_dec', 300)) {
      const p = item.promptAr!;
      if (has(p, 'أيّ الأعداد')) {
        kinds.add('which');
        const t = dnums(p)[0]!;
        for (const o of listOf(p)) assert.equal(Math.round(Number(o)) === t, o === item.answer, `${p}: ${o}`);
      } else if (has(p, 'كغ') || has(p, ' م.')) {
        kinds.add('measure');
        assert.equal(Number(item.answer), Math.round(dnums(p)[0]!), p);
      } else {
        const places = has(p, 'أقرب جزء من عشرة') ? 1 : has(p, 'أقرب جزء من مئة') ? 2 : 0;
        assert.ok(places > 0 || has(p, 'أقرب عدد كلي'), p);
        kinds.add(`places ${places}`);
        assert.equal(Number(item.answer), Math.round(dnums(p)[0]! * 10 ** places + 1e-9) / 10 ** places, p);
        assert.equal(item.answer.split('.')[1]?.length ?? 0, places, `${p}: ${item.answer} has the wrong number of places`);
      }
    }
    assert.equal(kinds.size, 5, [...kinds].join());
  });

  it('estimating a sum or difference: greatest place, nearest ten or hundred, a word problem', () => {
    for (const id of ['est_sum', 'est_add', 'est_sub']) {
      const kinds = new Set<string>();
      for (const { item } of draws(id, 300)) {
        const p = item.promptAr!;
        const sub = has(p, '−') || has(p, 'الباقية') || has(p, 'طرحت');
        if (id === 'est_add') assert.ok(!sub, p);
        if (id === 'est_sub') assert.ok(sub, p);
        if (has(p, 'أقرب إلى ناتج')) {
          // the listed round number nearest the exact result, and no other as near
          kinds.add('closest');
          const [a, b] = nums(p.split(':')[0]!);
          const exact = sub ? a! - b! : a! + b!;
          const listed = listOf(p).map(Number);
          assert.ok(listed.includes(Number(item.answer)) && item.wrongs.every(w => listed.includes(Number(w))), p);
          const gap = (x: number) => Math.abs(x - exact);
          for (const o of listed) if (o !== Number(item.answer)) assert.ok(gap(o) > gap(Number(item.answer)), `${p}: ${o} is as near`);
          continue;
        }
        if (has(p, 'قرّبت سلمى')) {
          // the estimate less the shown number rounded (sum), or the shown number rounded less the estimate (difference)
          kinds.add('back');
          const [est, shown] = nums(p);
          const place = placeIn(p);
          const r = Math.round(shown! / place) * place;
          const want = sub ? r - est! : est! - r;
          assert.ok(want > 0 && want % place === 0, p);
          assert.equal(Number(item.answer), want, p);
          continue;
        }
        const [a, b] = nums(p);
        const r = has(p, 'أكبر منزلة') ? lead : (n: number) => Math.round(n / placeIn(p)) * placeIn(p);
        kinds.add(has(p, 'أكبر منزلة') ? 'lead' : has(p, 'زوّار') || has(p, 'مكتبة') ? 'word' : 'place');
        assert.equal(Number(item.answer), sub ? r(a!) - r(b!) : r(a!) + r(b!), p);
      }
      assert.equal(kinds.size, 5, `${id}: ${[...kinds].join()}`);
    }
  });

  it('estimating a product: greatest place, a word problem, and the estimate picks the real product', () => {
    const kinds = new Set<string>();
    for (const { item } of draws('est_prod', 300)) {
      const p = item.promptAr!;
      const [a, b, ...rest] = nums(p);
      if (has(p, 'أيّ الأعداد')) {
        kinds.add('which');
        assert.equal(Number(item.answer), a! * b!, p);
        // the product is the option nearest the estimate, by ratio: an estimate is enough to choose it
        const est = lead(a!) * lead(b!);
        const far = (x: number) => Math.abs(Math.log(x / est));
        for (const o of rest) if (o !== a! * b!) assert.ok(far(o) > far(a! * b!), `${p}: ${o}`);
      } else {
        kinds.add(has(p, 'مستودع') ? 'word' : 'plain');
        assert.equal(Number(item.answer), lead(a!) * lead(b!), p);
      }
    }
    assert.equal(kinds.size, 3, [...kinds].join());
  });

  it('estimating a quotient: rounding the dividend, compatible numbers, a word problem', () => {
    const kinds = new Set<string>();
    for (const { item } of draws('est_quot', 300)) {
      const p = item.promptAr!;
      const ns = nums(p);
      const [n, d] = ns;
      if (has(p, 'المتناغمة')) {
        kinds.add('compatible');
        const M = ns[ns.length - 1]!;
        assert.equal(M % d!, 0, p);
        const c = Math.round(n! / M) * M;
        assert.ok(Math.abs(n! - c) < M / 2, p);
        assert.equal(Number(item.answer), c / d!, p);
      } else {
        kinds.add(has(p, 'دراجات') ? 'word' : 'round');
        const unit = placeIn(p);
        assert.notEqual(n! % unit, 0, `${p}: nothing to round`);
        assert.equal(Number(item.answer), (Math.round(n! / unit) * unit) / d!, p);
      }
    }
    assert.equal(kinds.size, 3, [...kinds].join());
  });

  it('estimating with decimals: nearest whole number, nearest ten, a measurement problem', () => {
    const kinds = new Set<string>();
    for (const { item } of draws('est_sum_dec', 300)) {
      const p = item.promptAr!;
      const [x, y] = dnums(p);
      const sub = has(p, '−') || has(p, 'الباقي');
      const unit = has(p, 'أقرب عشرة') ? 10 : 1;
      const r = (v: number) => Math.round(v / unit) * unit;
      kinds.add(has(p, 'عدّاء') || has(p, 'حبل') ? 'word' : `unit ${unit}`);
      assert.equal(Number(item.answer), sub ? r(x!) - r(y!) : r(x!) + r(y!), p);
    }
    assert.equal(kinds.size, 3, [...kinds].join());
  });

  it('multiples of ten: compute, the missing factor, a basic fact extended, a word problem', () => {
    const kinds = new Set<string>();
    for (const { item } of draws('tens_mul', 300)) {
      const p = item.promptAr!;
      const ns = nums(p);
      const ans = Number(item.answer);
      if (has(p, '▢')) { kinds.add('missing'); assert.equal(ns[0]! * ans, ns[1], p); }
      else if (has(p, 'إذا كان')) { kinds.add('fact'); assert.equal(ns[0]! * ns[1]!, ns[2], p); assert.equal(ans, ns[3]! * ns[4]!, p); }
      else if (has(p, 'صندوق')) { kinds.add('word'); assert.equal(ans, ns[0]! * ns[1]!, p); }
      else { kinds.add('plain'); assert.equal(ans, js(p.replace(/^أوجد ناتج /, '').replace(/\.$/, '')), p); }
    }
    assert.equal(kinds.size, 4, [...kinds].join());
    const divKinds = new Set<string>();
    for (const { item } of draws('tens_div', 300)) {
      const p = item.promptAr!;
      const ns = nums(p);
      if (has(p, 'إذا كان')) { divKinds.add('fact'); assert.equal(ns[0]! / ns[1]!, ns[2], p); assert.equal(Number(item.answer), ns[3]! / ns[4]!, p); }
      else { divKinds.add(has(p, 'وُزِّع') ? 'word' : 'plain'); assert.equal(Number(item.answer), ns[0]! / ns[1]!, p); }
    }
    assert.equal(divKinds.size, 3, [...divKinds].join());
  });

  it('factors and primes', () => {
    const kinds = new Set<string>();
    for (const { item } of draws('factors', 300)) {
      const p = item.promptAr!;
      const [n] = nums(p);
      const ans = Number(item.answer);
      if (has(p, 'كم عاملًا')) { kinds.add('count'); assert.equal(ans, divs(n!).length, p); }
      else if (has(p, 'ما أكبر عامل')) { kinds.add('largest'); assert.equal(ans, divs(n!).filter(x => x < n!).pop(), p); }
      else if (has(p, 'جميع عوامل')) { kinds.add('list'); assert.deepEqual(item.answer.split(' ، ').map(Number), divs(n!), p); }
      else if (has(p, 'ليس عاملًا')) {
        kinds.add('not');
        for (const o of listOf(p)) assert.equal(n! % Number(o) !== 0, o === item.answer, `${p}: ${o}`);
      } else assert.fail(`unknown stem: ${p}`);
    }
    assert.equal(kinds.size, 4, [...kinds].join());

    const primeKinds = new Set<string>();
    for (const { item } of draws('primes', 300)) {
      const p = item.promptAr!;
      const ans = Number(item.answer);
      if (has(p, 'ما أصغر عدد أولي')) {
        primeKinds.add('next');
        const [lo] = nums(p);
        assert.ok(isPrime(ans) && ans > lo!, p);
        for (let k = lo! + 1; k < ans; k++) assert.ok(!isPrime(k), `${k} is prime and smaller than ${ans}`);
        for (const w of item.wrongs) assert.ok(!isPrime(Number(w)), `wrong ${w} is prime`);
      } else if (has(p, 'عدد غير أولي')) {
        primeKinds.add('composite');
        for (const o of listOf(p)) assert.equal(!isPrime(Number(o)), o === item.answer, `${p}: ${o}`);
      } else if (has(p, 'عدد أولي:')) {
        primeKinds.add('prime');
        for (const o of listOf(p)) assert.equal(isPrime(Number(o)), o === item.answer, `${p}: ${o}`);
      } else if (has(p, 'كم عددًا أوليًّا')) {
        primeKinds.add('count');
        const [a, b] = nums(p);
        // both ends composite, so it does not matter whether «between» includes them
        assert.ok(!isPrime(a!) && !isPrime(b!), p);
        assert.equal(ans, Array.from({ length: b! - a! - 1 }, (_, i) => a! + 1 + i).filter(isPrime).length, p);
      } else assert.fail(`unknown stem: ${p}`);
    }
    assert.equal(primeKinds.size, 4, [...primeKinds].join());
  });

  it('gcf and lcm: compute, the common factors or first multiples, and a word problem', () => {
    const kinds = new Set<string>();
    for (const { item } of draws('gcf', 300)) {
      const p = item.promptAr!;
      const [a, b] = nums(p);
      if (has(p, 'العوامل المشتركة')) { kinds.add('common'); assert.deepEqual(item.answer.split(' ، ').map(Number), divs(a!).filter(x => b! % x === 0), p); }
      else { kinds.add(has(p, 'مجموعات') ? 'groups' : 'gcf'); assert.equal(Number(item.answer), gcd(a!, b!), p); }
    }
    assert.equal(kinds.size, 3, [...kinds].join());
    const lcmKinds = new Set<string>();
    for (const { item } of draws('lcm', 300)) {
      const p = item.promptAr!;
      const [a, b] = nums(p);
      if (has(p, 'أول أربعة مضاعفات')) { lcmKinds.add('multiples'); assert.deepEqual(item.answer.split(' ، ').map(Number), [a!, 2 * a!, 3 * a!, 4 * a!], p); continue; }
      lcmKinds.add(has(p, 'نبتة') ? 'word' : 'lcm');
      const m = Array.from({ length: a! * b! }, (_, i) => i + 1).find(x => x % a! === 0 && x % b! === 0)!;
      assert.equal(Number(item.answer), m, p);
    }
    assert.equal(lcmKinds.size, 3, [...lcmKinds].join());
  });

  it('divisibility: the missing digit, which listed number is divisible, how many are', () => {
    const kinds = new Set<string>();
    for (const { item } of draws('divisibility', 300)) {
      const p = item.promptAr!;
      if (has(p, 'أصغر عدد أكبر من') || has(p, 'من بين الأعداد')) continue; // recomputed below
      const d = Number(p.match(/على (\d+)/)![1]);
      if (has(p, 'رقم يوضع')) {
        kinds.add('digit');
        const shown = p.match(/العدد (\S*■\S*)/)![1]!;
        const ok: number[] = [];
        for (let v = shown.startsWith('■') ? 1 : 0; v <= 9; v++) if (Number(shown.replace('■', String(v))) % d === 0) ok.push(v);
        assert.ok(ok.length > 0 && ok.length < 10, shown);
        assert.equal(Number(item.answer), has(p, 'أكبر') ? Math.max(...ok) : Math.min(...ok), `${shown} ÷ ${d}`);
      } else if (has(p, 'أيّ الأعداد')) {
        kinds.add('which');
        for (const o of listOf(p)) assert.equal(Number(o) % d === 0, o === item.answer, `${p}: ${o}`);
      } else if (has(p, 'كم عددًا')) {
        kinds.add('count');
        assert.equal(Number(item.answer), listOf(p).filter(o => Number(o) % d === 0).length, p);
      } else assert.fail(`unknown stem: ${p}`);
    }
    for (const { item } of draws('divisibility', 300)) {
      const p = item.promptAr!;
      if (has(p, 'أصغر عدد أكبر من')) {
        // count up from n until the division comes out whole
        kinds.add('next');
        const [n, d] = nums(p);
        let x = n! + 1;
        while (x % d! !== 0) x++;
        assert.equal(Number(item.answer), x, p);
        assert.ok(item.wrongs.every(w => !(Number(w) > n! && Number(w) % d! === 0 && Number(w) <= x)), `${p}: ${item.wrongs}`);
      } else if (has(p, 'من بين الأعداد')) {
        kinds.add('which divisors');
        const [n, ...pool] = nums(p);
        assert.ok(pool.join() === '2,3,5,10' || pool.join() === '4,6,9', p);
        const want = pool.filter(q => n! % q === 0);
        assert.ok(want.length > 0, p);
        assert.deepEqual(item.answer.split(' ، ').map(Number), want, p);
        assert.ok(!item.wrongs.includes(want.join(' ، ')), p);
      }
    }
    assert.equal(kinds.size, 5, [...kinds].join());
  });

  it('prime factorisation: factorise, the number from its factors, the largest prime factor', () => {
    const kinds = new Set<string>();
    for (const { item } of draws('prime_fact', 300)) {
      const p = item.promptAr!;
      if (has(p, 'حلّل')) {
        kinds.add('factorise');
        const f = item.answer.split(' × ').map(Number);
        assert.equal(f.reduce((a, b) => a * b, 1), nums(p)[0], p);
        for (const x of f) assert.ok(isPrime(x), `${x} is not prime`);
        assert.deepEqual(f, [...f].sort((a, b) => a - b));
      } else if (has(p, 'تحليله')) {
        kinds.add('product');
        const f = nums(p);
        for (const x of f) assert.ok(isPrime(x), p);
        assert.equal(Number(item.answer), f.reduce((a, b) => a * b, 1), p);
      } else if (has(p, 'أكبر عامل أولي')) {
        kinds.add('largest');
        const [n] = nums(p);
        assert.equal(Number(item.answer), Math.max(...divs(n!).filter(isPrime)), p);
      } else assert.fail(`unknown stem: ${p}`);
    }
    assert.equal(kinds.size, 3, [...kinds].join());
  });

  it('squares, cubes, roots: compute, a square plot, which number is a perfect square', () => {
    const kinds = new Set<string>();
    for (const { item } of draws('squares', 300)) {
      const p = item.promptAr!;
      const [x] = nums(p);
      const ans = Number(item.answer);
      if (has(p, 'أوجد مربع العدد')) { kinds.add('square'); assert.equal(ans, x! ** 2, p); }
      else if (has(p, '√')) { kinds.add('root'); assert.equal(ans ** 2, x, p); }
      else if (has(p, '∛')) { kinds.add('cube'); assert.equal(ans ** 3, x, p); }
      else if (has(p, '³')) { kinds.add('cube'); assert.equal(ans, x! ** 3, p); }
      else if (has(p, 'ما طول ضلعها')) { kinds.add('side'); assert.equal(ans ** 2, x, p); }
      else if (has(p, 'ما مساحته')) { kinds.add('area'); assert.equal(ans, x! ** 2, p); }
      else if (has(p, 'مربع كامل')) {
        kinds.add('perfect');
        for (const o of listOf(p)) assert.equal(Number.isInteger(Math.sqrt(Number(o))), o === item.answer, `${p}: ${o}`);
      } else assert.fail(`unknown stem: ${p}`);
    }
    assert.equal(kinds.size, 6, [...kinds].join());
  });

  it('powers: as a power, its value, as repeated multiplication, a number as a power of a base', () => {
    const kinds = new Set<string>();
    for (const { item } of draws('powers', 300)) {
      const p = item.promptAr!;
      if (has(p, 'باستعمال الأسس')) {
        kinds.add('to power');
        const f = p.match(/اكتب (.+) باستعمال/)![1]!.split(' × ').map(Number);
        assert.ok(f.every(x => x === f[0]), p);
        assert.equal(item.answer, `${f[0]}${toSup(f.length)}`, p);
      } else if (has(p, 'ضرب متكرر')) {
        kinds.add('expand');
        const m = p.match(/القوة (\d+)([⁰-⁹¹²³]+)/)!;
        assert.deepEqual(item.answer.split(' × ').map(Number), Array(fromSup(m[2]!)).fill(Number(m[1])), p);
      } else if (has(p, 'قوة أساسها')) {
        kinds.add('base');
        const [v, base] = nums(p);
        const m = item.answer.match(/^(\d+)([⁰-⁹¹²³]+)$/)!;
        assert.equal(Number(m[1]), base, p);
        assert.equal(base! ** fromSup(m[2]!), v, p);
      } else {
        kinds.add('value');
        const m = p.match(/(\d+)([⁰-⁹¹²³]+)/)!;
        assert.equal(Number(item.answer), Number(m[1]) ** fromSup(m[2]!), p);
      }
    }
    assert.equal(kinds.size, 4, [...kinds].join());
  });

  it('order of operations: evaluate, place one pair of brackets, correct a left-to-right slip', () => {
    const kinds = new Set<string>();
    for (const { item } of draws('order_ops', 300)) {
      const p = item.promptAr!;
      if (has(p, 'ضع قوسين')) {
        kinds.add('brackets');
        const expr = p.match(/المقدار (.+) ليصبح/)![1]!;
        const target = nums(p).pop()!;
        assert.equal(js(item.answer), target, p);
        assert.equal(item.answer.replace(/[()]/g, ''), expr, p);
        for (const w of item.wrongs) {
          assert.equal(w.replace(/[()]/g, ''), expr, `${p}: ${w}`);
          assert.notEqual(js(w), target, `${p}: ${w} also gives ${target}`);
        }
        continue;
      }
      const expr = has(p, 'حسب طالب') ? p.match(/المقدار (.+) بإجراء/)![1]! : p.replace(/^أوجد قيمة المقدار: /, '');
      const v = js(expr);
      assert.equal(Number(item.answer), v, p);
      assert.ok(Number.isInteger(v) && v >= 0, p);
      if (has(p, 'حسب طالب')) {
        kinds.add('slip');
        const slip = Number(p.match(/فحصل على (\d+)/)![1]);
        assert.equal(slip, leftToRight(expr), `${p}: left to right gives ${leftToRight(expr)}`);
        assert.notEqual(slip, v, p);
      } else {
        kinds.add('evaluate');
        // at least one slip (left-to-right or ignoring brackets) must be offered
        const noParens = js(expr.replace(/[()]/g, ''));
        if (noParens !== v && noParens >= 0) assert.ok(item.wrongs.includes(String(noParens)), `${expr}: ignoring brackets gives ${noParens}`);
      }
    }
    assert.equal(kinds.size, 3, [...kinds].join());
  });

  it('integers: compute, real-life problems, the missing number, an expression', () => {
    const kindsOf: Record<string, Set<string>> = { int_add: new Set(), int_sub: new Set(), int_muldiv: new Set() };
    for (const id of ['int_add', 'int_sub', 'int_muldiv']) {
      for (const { item } of draws(id, 300)) {
        const p = item.promptAr!;
        const [a, b] = snums(p);
        const ans = num(item.answer);
        const k = kindsOf[id]!;
        // `eq` is always the calculation; check it too
        assert.equal(ans, js(item.eq), `${p} | ${item.eq}`);
        if (has(p, 'أوجد ناتج')) {
          k.add('compute');
          const op = ['×', '÷', '+', ' − '].find(o => has(p, o))!;
          assert.equal(ans, op === '+' ? a! + b! : op === ' − ' ? a! - b! : op === '×' ? a! * b! : a! / b!, p);
        } else if (has(p, 'أوجد قيمة المقدار')) { k.add('expression'); assert.equal(ans, js(p.replace(/^أوجد قيمة المقدار: /, '')), p); }
        else if (has(p, 'صباحًا')) { k.add('temperature'); assert.equal(ans, a! + (has(p, 'ارتفعت') ? b! : -b!), p); }
        else if (has(p, 'مصعد')) { k.add('lift'); assert.equal(ans, a! + (has(p, 'ثم صعد') ? b! : -b!), p); }
        else if (has(p, 'أُضيف إلى')) { k.add('missing'); assert.equal(a! + ans, b, p); }
        else if (has(p, 'طُرح من')) { k.add('missing'); assert.equal(a! - ans, b, p); }
        else if (has(p, 'بكم درجة')) { k.add('difference'); assert.ok(a! > b!, p); assert.equal(ans, a! - b!, p); }
        else if (has(p, 'بالتساوي')) { k.add('share'); assert.equal(ans, a! / b!, p); }
        else if (has(p, 'كل ساعة')) { k.add('rate'); assert.equal(ans, -a! * b!, p); }
        else assert.fail(`unknown stem: ${p}`);
      }
    }
    assert.equal(kindsOf.int_add!.size, 4, [...kindsOf.int_add!].join());
    assert.equal(kindsOf.int_sub!.size, 3, [...kindsOf.int_sub!].join());
    assert.equal(kindsOf.int_muldiv!.size, 4, [...kindsOf.int_muldiv!].join());

    const absKinds = new Set<string>();
    for (const { item } of draws('int_abs', 300)) {
      const p = item.promptAr!;
      const [a] = snums(p);
      if (has(p, 'أوجد قيمة |')) { absKinds.add('abs'); assert.equal(num(item.answer), Math.abs(a!), p); }
      else if (has(p, 'المقابل')) { absKinds.add('opposite'); assert.equal(num(item.answer), -a!, p); }
      else if (has(p, 'اللذان')) { absKinds.add('both'); assert.deepEqual(item.answer.split(' ، ').map(num), [-a!, a!], p); }
      else if (has(p, 'تحت سطح البحر')) { absKinds.add('depth'); assert.equal(num(item.answer), -a!, p); }
      else if (has(p, 'فوق سطح البحر')) { absKinds.add('height'); assert.equal(num(item.answer), a!, p); }
      else assert.fail(`unknown stem: ${p}`);
    }
    assert.equal(absKinds.size, 5, [...absKinds].join());

    const cmpKinds = new Set<string>();
    for (const { item } of draws('int_compare', 300)) {
      const p = item.promptAr!;
      if (has(p, 'الإشارة')) {
        cmpKinds.add('sign');
        const [a, b] = p.split('\n')[1]!.split(' ___ ').map(num);
        assert.equal(item.answer, a! < b! ? '<' : '>', p);
        continue;
      }
      const xs = listOf(p).map(num);
      if (has(p, 'أصغر')) { cmpKinds.add('smallest'); assert.equal(num(item.answer), Math.min(...xs), p); }
      else if (has(p, 'تصاعديًا')) { cmpKinds.add('ascending'); assert.deepEqual(item.answer.split(' ، ').map(num), [...xs].sort((x, y) => x - y), p); }
      else if (has(p, 'تنازليًا')) { cmpKinds.add('descending'); assert.deepEqual(item.answer.split(' ، ').map(num), [...xs].sort((x, y) => y - x), p); }
      else assert.fail(`unknown stem: ${p}`);
    }
    assert.equal(cmpKinds.size, 4, [...cmpKinds].join());

    for (const { item } of draws('int_intro')) {
      if (item.eq.includes('___')) {
        const [a, b] = item.eq.split(' ___ ').map(num);
        assert.equal(item.answer, a! < b! ? '<' : '>');
      }
    }
  });

  it('equivalent fractions and ratios', () => {
    const kinds = new Set<string>();
    for (const { item, grade } of draws('equiv_frac', 300)) {
      const p = item.promptAr!;
      const [n, d, k] = nums(p);
      if (has(p, 'أكمل')) { kinds.add('complete'); assert.ok(close(Number(item.answer) / k!, n! / d!), p); }
      else if (has(p, 'يكافئ الكسر')) {
        kinds.add('which');
        for (const o of listOf(p)) assert.equal(close(value(o)!, n! / d!), o === item.answer, `${p}: ${o}`);
      } else if (has(p, 'اضرب كلًّا')) { kinds.add('multiply'); assert.equal(item.answer, `${n! * k!}/${d! * k!}`, p); }
      else if (has(p, 'أبسط صورة')) {
        kinds.add('simplest');
        assert.ok(grade >= 4, `${p}: simplest form is a Grade 4 objective`);
        assert.ok(close(value(item.answer)!, n! / d!), p);
        lowest(item.answer);
      } else assert.fail(`unknown stem: ${p}`);
    }
    assert.equal(kinds.size, 4, [...kinds].join());

    const rKinds = new Set<string>();
    for (const { item } of draws('ratio_equiv', 300)) {
      const p = item.promptAr!;
      const [a, b, c] = nums(p);
      if (has(p, 'تكافئ النسبة')) {
        rKinds.add('which');
        for (const o of listOf(p)) { const [x, y] = nums(o); assert.equal(x! * b! === y! * a!, o === item.answer, `${p}: ${o}`); }
      } else { rKinds.add(has(p, 'وصفة') ? 'recipe' : 'complete'); assert.equal(a! * Number(item.answer), b! * c!, p); }
    }
    assert.equal(rKinds.size, 3, [...rKinds].join());

    const ratioKinds = new Set<string>();
    for (const { item } of draws('ratio', 300)) {
      const p = item.promptAr!;
      const [a, b] = nums(p);
      if (has(p, 'كم في')) { ratioKinds.add('speed'); assert.equal(Number(item.answer), a! / b!, p); continue; }
      if (has(p, 'دفاتر')) { ratioKinds.add('price'); assert.equal(Number(item.answer), b! / a!, p); continue; }
      // boys : girls, girls : everyone, or the ratio as printed
      const [x, y] = has(p, 'طلبة الصف') ? [b!, a! + b!] : [a!, b!];
      ratioKinds.add(has(p, 'طلبة الصف') ? 'part-whole' : has(p, 'الطالبات') ? 'part-part' : 'simplest');
      const [s, t] = nums(item.answer);
      assert.equal(x * t!, y * s!, `${p} → ${item.answer}`);
      assert.equal(gcd(s!, t!), 1, item.answer);
    }
    assert.equal(ratioKinds.size, 5, [...ratioKinds].join());
  });

  it('mixed and improper fractions', () => {
    const kinds = new Set<string>();
    for (const { item } of draws('mixed_improper', 300)) {
      const p = item.promptAr!;
      if (has(p, 'أيّ الكسور')) {
        kinds.add('which');
        for (const o of listOf(p)) { const [x, y] = nums(o); assert.equal(x! > y!, o === item.answer, `${p}: ${o}`); }
        continue;
      }
      const m = p.match(/(\d+) (\d+)\/(\d+)/);
      if (has(p, 'فطيرة')) {
        kinds.add('pieces');
        const [, d, n] = nums(p); // «1/d الفطيرة», then n pieces
        assert.ok(close(value(item.answer)!, n! / d!), p);
      } else if (m) { kinds.add('to improper'); assert.ok(close(value(item.answer)!, Number(m[1]) + Number(m[2]) / Number(m[3])), p); }
      else { kinds.add('to mixed'); const [n, d] = nums(p); assert.ok(close(value(item.answer)!, n! / d!), p); }
      for (const w of item.wrongs) { const f = w.match(/^\d+ (\d+)\/(\d+)$/); if (f) assert.ok(Number(f[1]) > 0 && Number(f[1]) < Number(f[2]), `malformed mixed number ${w}`); }
    }
    assert.equal(kinds.size, 4, [...kinds].join());
  });

  it('mixed-number operations, word problems, the missing addend, × a whole number, the reciprocal', () => {
    const mixedIn = (s: string) => [...s.matchAll(/(\d+) (\d+)\/(\d+)/g)].map(m => Number(m[1]) + Number(m[2]) / Number(m[3]));
    const want: Record<string, number> = { mixed_addsub: 4, mixed_mul: 3, mixed_div: 3 };
    for (const t of ['mixed_addsub', 'mixed_mul', 'mixed_div']) {
      const kinds = new Set<string>();
      for (const { item } of draws(t, 300)) {
        const p = item.promptAr!;
        const [A, B] = mixedIn(p);
        let w: number;
        if (has(p, 'أوجد ناتج')) {
          kinds.add('compute');
          const op = p.match(/\d ([+−×÷]) \d/)![1];
          w = op === '+' ? A! + B! : op === '−' ? A! - B! : op === '×' ? A! * B! : A! / B!;
        } else if (has(p, 'أُضيف إلى')) { kinds.add('missing'); w = sval(p.match(/الناتج (.+?)؟/)![1]!) - A!; }
        else if (has(p, 'قطعت سلمى')) { kinds.add('word'); w = A! + B!; }
        else if (has(p, 'حبل')) { kinds.add('word −'); w = A! - B!; }
        else if (has(p, 'مساحة مستطيل')) { kinds.add('word'); w = A! * B!; }
        else if (has(p, 'اضرب العدد الكسري')) { kinds.add('× whole'); w = A! * Number(p.match(/ في (\d+)،/)![1]); }
        else if (has(p, 'شريط')) { kinds.add('word'); w = sval(p.match(/طوله (.+?) م،/)![1]!) / sval(p.match(/منها (.+?) م\./)![1]!); assert.ok(close(w, Math.round(w)), p); }
        else if (has(p, 'مقلوب')) { kinds.add('reciprocal'); w = 1 / A!; }
        else assert.fail(`unknown stem: ${p}`);
        assert.ok(close(value(item.answer)!, w), `${p} → ${item.answer} (want ${w})`);
        assert.ok(w > 0, p);
        lowest(item.answer);
      }
      assert.equal(kinds.size, want[t], `${t}: ${[...kinds].join()}`);
    }
  });

  it('fractions, decimals and percents', () => {
    const kinds = new Set<string>();
    for (const { item, grade } of draws('frac_dec', 400)) {
      const p = item.promptAr!;
      if (has(p, 'بالصيغة القياسية')) {
        kinds.add('expanded');
        const sum = p.split(': ')[1]!.split(' + ').reduce((s, x) => s + Number(x), 0);
        assert.ok(close(Number(item.answer), sum), p);
      } else if (has(p, 'القيمة المنزلية')) {
        kinds.add('place');
        const [digit] = nums(p);
        const s = p.match(/العدد ([\d.]+)؟/)![1]!;
        const after = s.split('.')[1]!;
        assert.equal(after.split('').filter(c => Number(c) === digit).length, 1, p);
        assert.ok(close(Number(item.answer), digit! / 10 ** (after.indexOf(String(digit)) + 1)), p);
      } else if (has(p, 'بين أيّ عددين')) {
        kinds.add('between');
        assert.ok(grade >= 7, p);
        const f = sval(p.match(/النسبي (−?\d+\/\d+)/)![1]!);
        const [lo, hi] = item.answer.split(' ، ').map(num);
        assert.equal(hi, lo! + 1, p);
        assert.ok(lo! < f && f < hi!, p);
      } else if (has(p, 'كسر غير فعلي')) {
        kinds.add('mixed to improper');
        assert.ok(close(value(item.answer)!, sval(p.match(/العدد (−?\d+ \d+\/\d+)/)![1]!)), p);
        lowest(item.answer);
      } else {
        kinds.add(has(p, 'على صورة عدد عشري') ? 'to decimal' : 'to fraction');
        const shown = p.match(/(?:الكسر|العشري) (−?[\d./]+)/)![1]!;
        assert.ok(close(sval(shown), sval(item.answer)), `${shown} ≠ ${item.answer}`);
      }
    }
    assert.equal(kinds.size, 6, [...kinds].join());
    for (const { item } of draws('pct_conv')) {
      const a = value(item.eq), b = value(item.answer);
      assert.ok(a !== null && b !== null, `${item.eq} → ${item.answer}`);
      assert.ok(Math.abs(a! - b!) < 1e-9, `${item.eq} ≠ ${item.answer}`);
    }
    const NAMES: Record<string, number> = { 'العشرات': -2, 'الآحاد': -1, 'الأجزاء من عشرة': 1, 'الأجزاء من مئة': 2, 'الأجزاء من ألف': 3 };
    const placeKinds = new Set<string>();
    for (const { item } of draws('dec_place', 300)) {
      const p = item.promptAr!;
      const s = p.match(/العدد ([\d.]+)[؟:]?/)?.[1];
      if (has(p, 'بالصيغة القياسية')) {
        placeKinds.add('expanded');
        assert.ok(close(Number(item.answer), p.split(': ')[1]!.split(' + ').reduce((t, x) => t + Number(x), 0)), p);
      } else if (has(p, 'ما الرقم الذي في منزلة')) {
        placeKinds.add('digit in place');
        const at = NAMES[p.match(/منزلة (.+) في العدد/)![1]!]!;
        const [whole, frac] = s!.split('.');
        assert.equal(item.answer, at < 0 ? whole![whole!.length + at] : frac![at - 1], p);
      } else {
        placeKinds.add('place value');
        const digit = Number(p.match(/رقم (\d)/)![1]);
        const after = s!.slice(s!.indexOf('.') + 1);
        const pos = [...after].findIndex((c, i) => Number(c) === digit && close(Number(item.answer), digit / 10 ** (i + 1)));
        assert.ok(pos >= 0, `${s}: place value of ${digit} is not ${item.answer}`);
      }
    }
    assert.equal(placeKinds.size, 3, [...placeKinds].join());
  });

  it('rational numbers', () => {
    const fracsIn = (s: string) => (s.match(/−?\d+\/\d+/g) ?? []).map(sval);
    const cmp = new Set<string>();
    for (const { item } of draws('rat_compare', 300)) {
      const p = item.promptAr!;
      if (has(p, 'الإشارة')) { cmp.add('sign'); const [l, r] = fracsIn(p.split('\n')[1]!); assert.equal(item.answer, l! < r! ? '<' : '>', p); continue; }
      const xs = listOf(p).map(sval);
      if (has(p, 'تصاعديًا')) { cmp.add('order'); assert.deepEqual(item.answer.split(' ، ').map(sval), [...xs].sort((a, b) => a - b), p); }
      else { cmp.add('extreme'); assert.equal(sval(item.answer), has(p, 'أكبر') ? Math.max(...xs) : Math.min(...xs), p); }
    }
    assert.equal(cmp.size, 3, [...cmp].join());
    for (const t of ['rat_addsub', 'rat_muldiv']) {
      const kinds = new Set<string>();
      for (const { item } of draws(t, 300)) {
        const p = item.promptAr!;
        const [A, B] = fracsIn(p);
        let want: number;
        if (has(p, 'أوجد ناتج')) {
          kinds.add('compute');
          const op = ['+', '×', '÷', ' − '].find(o => has(p, o))!;
          want = op === '+' ? A! + B! : op === ' − ' ? A! - B! : op === '×' ? A! * B! : A! / B!;
        } else if (has(p, 'النظير الجمعي')) { kinds.add('inverse'); want = -A!; }
        else if (has(p, 'النظير الضربي')) { kinds.add('inverse'); want = 1 / A!; }
        else if (has(p, 'جندب')) { kinds.add('number line'); want = A! + (has(p, 'اليمين') ? B! : -B!); }
        else if (has(p, 'ضُرب في')) { kinds.add('missing'); want = (B ?? num(p.match(/الناتج (.+)؟/)![1]!)) / A!; }
        else assert.fail(`unknown stem: ${p}`);
        assert.ok(close(value(item.answer)!, want), `${p} = ${item.answer} (want ${want})`);
        lowest(item.answer);
      }
      assert.equal(kinds.size, 3, `${t}: ${[...kinds].join()}`);
    }
    const rep = new Set<string>();
    for (const { item } of draws('repeating', 300)) {
      const p = item.promptAr!;
      if (has(p, 'ما الأرقام التي تتكرر')) {
        rep.add('block');
        const [n, d] = nums(p);
        // the answer's digits must be the cycle of n/d: long-divide and look for it
        assert.ok(expansion(n!, d!, 60).includes(item.answer.repeat(3)), `${p}: ${item.answer}`);
      } else if (has(p, 'على صورة كسر')) {
        rep.add('to fraction');
        const shown = p.match(/الدوري (0\.\d+…)/)![1]!;
        const [n, d] = nums(item.answer);
        assert.equal(expansion(n!, d!), readRepeating(shown), `${shown} ≠ ${item.answer}`);
        lowest(item.answer);
      } else if (has(p, 'الإشارة')) {
        rep.add('compare');
        const [shown, other] = p.split('\n')[1]!.split(' ___ ');
        const digits = readRepeating(shown!);
        const f = other!.match(/^(\d+)\/(\d+)$/);
        const want = f ? (expansion(Number(f[1]), Number(f[2])) === digits ? '=' : Number(f[1]) / Number(f[2]) < Number(`0.${digits}`) ? '>' : '<')
          : Number(`0.${digits}`) > Number(other) ? '>' : '<';
        assert.equal(item.answer, want, p);
      } else assert.fail(`unknown stem: ${p}`);
    }
    assert.equal(rep.size, 3, [...rep].join());
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
    ['التطابق', 7, null],
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
