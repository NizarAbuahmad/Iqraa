/**
 * The Grades 1–9 lessons whose ready-made sheet was held back (2026-11-20): the
 * bank served them another lesson's or grade's questions. Six of the fifteen
 * were fixed by later reviews (or were held back by mistake); these are the
 * nine that were still wrong on 2026-11-27, one generator each. Every answer is
 * recomputed from the numbers printed in its own question, and each lesson is
 * checked for what it is about — the thing the held-back sheet was missing.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TOPICS, makeTopicItem, topicFor } from '../topics.ts';
import type { ConcreteItem, DiffTier } from '../index.ts';

const TIERS: DiffTier[] = ['easy', 'medium', 'hard'];

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function draws(id: string, grade: number, n = 300): ConcreteItem[] {
  const t = TOPICS.find(x => x.id === id);
  assert.ok(t, `no generator ${id}`);
  return Array.from({ length: n }, (_, i) => makeTopicItem(t, grade, TIERS[i % 3]!, new Set(), seeded(i * 7919 + 11)));
}
const nums = (s: string) => (s.replace(/−/g, '-').match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
/** «3/4», «−2/5», «7» → [n, d]. */
function ratio(s: string): [number, number] {
  const t = s.trim().replace(/−/g, '-');
  const m = t.match(/^(-?\d+)\/(\d+)$/);
  return m ? [Number(m[1]), Number(m[2])] : [Number(t), 1];
}
const same = ([a, b]: [number, number], [c, d]: [number, number]) => a * d === b * c;
const lowest = ([n, d]: [number, number]) => d === 1 || gcd(n, d) === 1;

describe('the held-back lessons route to their own generator', () => {
  for (const [title, grade, id] of [
    ['الشَّبَكاتُ وَالضَّرْبُ', 2, 'grids_g2'],
    ['ضَرْبُ الأَعْدادِ', 4, 'mul_g4'],
    ['ضَرْبُ الكُسورِ', 5, 'frac_mul_g5'],
    ['ضَرْبُ الأَعْدادِ الْعَشْرِيَّةِ وَقِسْمَتُها', 5, 'dec_pow10_g5'],
    ['كتابة العدد النسبي بالصورة العشرية', 7, 'rat_to_dec_g7'],
    ['المدرجات التكرارية', 9, 'histogram_g9'],
    // and the lesson the histogram one shared its bank with keeps it
    ['الجداول التكرارية ذات الفئات', 9, 'grouped_g9'],
  ] as const) {
    it(`«${title}» (grade ${grade}) → ${id}`, () => assert.equal(topicFor(title, grade)?.id, id));
  }
});

describe('«الشبكات والضرب» (grade 2): every question is a grid', () => {
  it('asks about rows and squares, and the answer is rows × squares', () => {
    for (const item of draws('grids_g2', 2)) {
      const p = item.promptAr!;
      assert.match(p, /شبكة/, p);
      if (p.includes('■')) {
        const rows = p.split('\n').filter(line => line.includes('■'));
        const count = rows.reduce((n, line) => n + [...line].filter(c => c === '■').length, 0);
        assert.equal(Number(item.answer), count, p);
        assert.equal(new Set(rows.map(r => [...r].filter(c => c === '■').length)).size, 1, `a grid has equal rows: ${p}`);
      } else if (/في كل صف\؟/.test(p)) {
        const [total, r] = nums(p);
        assert.equal(Number(item.answer), total! / r!, p);
      } else if (/جملة ضرب/.test(p)) {
        const [r, c] = nums(p);
        assert.equal(item.answer, `${r} × ${c}`, p);
      } else {
        const [r, c] = nums(p);
        assert.equal(Number(item.answer), r! * c!, p);
      }
    }
  });
});

describe('«ضرب الأعداد» (grade 4): 3-digit × 1-digit and 2-digit × 2-digit', () => {
  it('the answer is the product of the two printed factors, and both shapes are asked', () => {
    let threeByOne = 0, twoByTwo = 0;
    for (const item of draws('mul_g4', 4)) {
      const p = item.promptAr!;
      const [a, b] = nums(p);
      assert.equal(Number(item.answer), a! * b!, p);
      const [big, small] = a! >= b! ? [a!, b!] : [b!, a!];
      if (big >= 100 && big <= 999 && small >= 2 && small <= 9) threeByOne += 1;
      else if (big >= 10 && big <= 99 && small >= 10 && small <= 99) twoByTwo += 1;
      else assert.fail(`neither 3-digit × 1-digit nor 2-digit × 2-digit: ${p}`);
      assert.doesNotMatch(p, /\+|؟ ×|× ؟/, `no repeated addition or missing factor: ${p}`);
    }
    assert.ok(threeByOne > 50 && twoByTwo > 50, `3×1: ${threeByOne}, 2×2: ${twoByTwo}`);
  });
});

describe('«ضرب الكسور» (grade 5): a product in simplest form', () => {
  it('the answer is the product, in lowest terms, and no question asks for a missing factor', () => {
    for (const item of draws('frac_mul_g5', 5)) {
      const p = item.promptAr!;
      assert.doesNotMatch(p, /؟\s*=|=\s*؟|× ؟|؟ ×/, `a missing factor needs division of fractions: ${p}`);
      const fracs = [...p.replace(/−/g, '-').matchAll(/(\d+)\/(\d+)/g)].map(m => [Number(m[1]), Number(m[2])] as [number, number]);
      for (const [n, d] of fracs) assert.ok(n !== d && n > 0, `«${n}/${d}» is not a proper fraction: ${p}`);
      let product: [number, number];
      if (/ من /.test(p)) {
        // «ما 2/3 من 12؟»
        const [[n, d]] = fracs as [[number, number]];
        const whole = nums(p.split(' من ')[1]!)[0]!;
        product = [n * whole, d];
      } else if (fracs.length === 1) {
        // «4 × 2/9»
        const whole = nums(p.replace(/\d+\/\d+/g, ''))[0]!;
        product = [whole * fracs[0]![0], fracs[0]![1]];
      } else {
        product = [fracs[0]![0] * fracs[1]![0], fracs[0]![1] * fracs[1]![1]];
      }
      const key = ratio(item.answer);
      assert.ok(same(key, product), `«${p}» → ${item.answer}, but the product is ${product[0]}/${product[1]}`);
      assert.ok(lowest(key), `${item.answer} is not in simplest form: ${p}`);
    }
  });
});

describe('«ضرب الأعداد العشرية وقسمتها» (grade 5): by 10, 100 and 1000 only', () => {
  const POW = new Set([10, 100, 1000]);
  it('the other number is always 10, 100 or 1000, and the answer is exact', () => {
    for (const item of draws('dec_pow10_g5', 5)) {
      const p = item.promptAr!;
      const ns = nums(p);
      assert.ok(ns.some(n => POW.has(n)) || /× ؟|؟ ×/.test(p), `no 10, 100 or 1000: ${p}`);
      if (/× ؟|؟ ×/.test(p)) {
        const [x, y] = ns;
        assert.ok(POW.has(Number(item.answer)), p);
        assert.ok(Math.abs(x! * Number(item.answer) - y!) < 1e-9, p);
        continue;
      }
      const x = ns.find(n => !POW.has(n) || !Number.isInteger(n))!, k = ns.find(n => POW.has(n) && n !== x)!;
      const want = /اقسم|قسمة|يُقسم/.test(p) ? x / k : x * k;
      assert.ok(Math.abs(Number(item.answer) - want) < 1e-9, `«${p}» → ${item.answer}, want ${want}`);
      assert.ok(!/\.\d*0$/.test(item.answer), `a trailing zero: ${item.answer}`);
    }
  });
});

describe('«كتابة العدد النسبي بالصورة العشرية» (grade 7): fraction → decimal', () => {
  it('writes a fraction as a decimal, terminating or repeating, or says which it is', () => {
    let repeating = 0, classify = 0;
    for (const item of draws('rat_to_dec_g7', 7)) {
      const p = item.promptAr!;
      assert.doesNotMatch(p, /بين أيّ|غير فعلي|على صورة كسر/, `another lesson's question: ${p}`);
      const m = p.replace(/−/g, '-').match(/(-?)(?:(\d+) )?(\d+)\/(\d+)/)!;
      assert.ok(m, p);
      const sign = m[1] ? -1 : 1, whole = Number(m[2] ?? 0), n = Number(m[3]), d = Number(m[4]);
      const value = sign * (whole + n / d);
      let dd = d / gcd(n, d);
      while (dd % 2 === 0) dd /= 2;
      while (dd % 5 === 0) dd /= 5;
      const terminates = dd === 1;
      if (/منتهي|دوري/.test(p)) {
        classify += 1;
        assert.equal(item.answer, terminates ? 'كسر عشري منتهٍ' : 'كسر عشري دوري', p);
      } else if (item.answer.endsWith('…')) {
        repeating += 1;
        assert.ok(!terminates, p);
        const digits = item.answer.replace(/−/g, '-').replace('…', '');
        assert.ok(Math.abs(Number(digits) - value) < 1e-3, `«${p}» → ${item.answer}`);
      } else {
        assert.ok(terminates, `a repeating decimal keyed as a finite one: ${p}`);
        assert.ok(Math.abs(Number(item.answer.replace(/−/g, '-')) - value) < 1e-9, `«${p}» → ${item.answer}`);
      }
    }
    assert.ok(repeating > 10 && classify > 10, `repeating ${repeating}, classify ${classify}`);
  });
});

describe('«المدرجات التكرارية» (grade 9): histograms and frequency density', () => {
  it('every question is about a histogram, and its answer follows from the numbers given', () => {
    let density = 0;
    for (const item of draws('histogram_g9', 9)) {
      const p = item.promptAr!;
      assert.match(p, /مدرج تكراري|الكثافة التكرارية/, p);
      const pairs = [...p.matchAll(/(\d+)–(\d+): (\d+)/g)].map(m => [Number(m[1]), Number(m[2]), Number(m[3])] as const);
      if (/الكثافة التكرارية/.test(p) && pairs.length === 0) {
        density += 1;
        const [, a, b, f] = p.match(/(\d+)–(\d+)\D+?(\d+(?:\.\d+)?)/) ?? [];
        const w = Number(b) - Number(a) + 1;
        if (/ما تكرار/.test(p)) assert.equal(Number(item.answer), Number(f) * w, p);
        else assert.equal(Number(item.answer), Number(f) / w, p);
        continue;
      }
      if (/أطول عمود/.test(p)) {
        const top = Math.max(...pairs.map(x => x[2]));
        assert.equal(pairs.filter(x => x[2] === top).length, 1, `a tie for the tallest: ${p}`);
        assert.equal(item.answer, `${pairs.find(x => x[2] === top)![0]}–${pairs.find(x => x[2] === top)![1]}`, p);
      } else if (/طول الفئة|طول كل فئة/.test(p)) {
        assert.equal(Number(item.answer), pairs[0]![1] - pairs[0]![0] + 1, p);
      } else if (/الكلي/.test(p)) {
        assert.equal(Number(item.answer), pairs.reduce((s, x) => s + x[2], 0), p);
      } else {
        const from = Number(p.match(/(\d+) فأكثر/)?.[1] ?? NaN), below = Number(p.match(/أقل من (\d+)/)?.[1] ?? NaN);
        const want = pairs.filter(x => (Number.isNaN(from) ? x[1] < below : x[0] >= from)).reduce((s, x) => s + x[2], 0);
        assert.equal(Number(item.answer), want, p);
      }
    }
    assert.ok(density > 20, `density asked ${density} times`);
  });
});

describe('«الزوايا» (grade 3): kinds of angle, with no degrees', () => {
  it('never prints a degree measure; the answer is a kind of angle or a count', () => {
    for (const item of draws('angle_kind_g3', 3)) {
      const p = item.promptAr!;
      assert.doesNotMatch(p, /°|درجة/, `degrees are Grade 4: ${p}`);
      assert.ok(['حادة', 'قائمة', 'منفرجة'].includes(item.answer) || /^\d+$/.test(item.answer), `${p} → ${item.answer}`);
    }
  });
});

describe('«تقريب الأعداد العشرية» (grade 4): to hundredths at most, real measures', () => {
  it('no number has more than two decimal places, and no table is longer than a room', () => {
    for (const item of draws('round_dec', 4)) {
      const p = item.promptAr!;
      for (const n of p.match(/\d+\.\d+/g) ?? []) assert.ok(n.split('.')[1]!.length <= 2, `thousandths are Grade 5: ${p}`);
      const table = p.match(/طول طاولة (\d+(?:\.\d+)?) م/);
      if (table) assert.ok(Number(table[1]) < 5, `a ${table[1]} m table: ${p}`);
      const bag = p.match(/كتلة حقيبة (\d+(?:\.\d+)?) كغ/);
      if (bag) assert.ok(Number(bag[1]) < 30, `a ${bag[1]} kg bag: ${p}`);
    }
  });
  it('Grade 5 still rounds thousandths', () => {
    assert.ok(draws('round_dec', 5).some(item => /\d+\.\d{3}/.test(item.promptAr!)));
  });
});

describe('«تمييز متوازي الأضلاع» (grade 8): each condition really proves it', () => {
  it('a «what makes ABCD a parallelogram» question gives a sufficient condition', () => {
    for (const item of draws('parallelogram_test', 8)) {
      const p = item.promptAr!;
      if (!/ما قيمة x/.test(p)) continue;
      if (/AB = /.test(p)) assert.match(p, /AB ∥ CD/, `one pair of equal sides is not enough: ${p}`);
      else if (/∠A = /.test(p)) assert.match(p, /∠B = ∠D/, `one pair of equal angles is not enough: ${p}`);
      else if (/AM = /.test(p)) assert.match(p, /BM = MD/, `one diagonal halved is not enough: ${p}`);
      else assert.fail(`an unknown condition: ${p}`);
      assert.doesNotMatch(p, /(?<!∠)\b[AC] = \(/, `an angle is named ∠A, not A: ${p}`);
    }
  });
});
