/**
 * Grade 1–6 maths items, built from the lesson and sized to the grade.
 *
 * The bank in `index.ts` is Grade 10 (exponential equations, systems, circles,
 * derivatives…). Every other maths lesson fell through to its `algebra`
 * family, so a Grade 2 «الجمع» quiz asked about «x² = 49» and simultaneous
 * equations (seen on app.iqrra.com, 2026-09-26). Primary arithmetic is
 * generated rather than banked: the operation comes from the lesson, the
 * number range from the grade, and every answer is computed, never typed.
 *
 * Digits are Latin, like the rest of the bank — conversion to Arabic digits
 * happens at display time (CLAUDE.md).
 */
import type { ConcreteItem, DiffTier } from './index.ts';

export type ElementaryOp =
  | 'add' | 'sub' | 'mul' | 'div' | 'compare' | 'place'
  | 'frac' | 'frac_sub' | 'frac_mul' | 'frac_div' | 'frac_compare'
  | 'dec' | 'dec_sub' | 'dec_mul' | 'dec_div' | 'dec_compare'
  | 'percent';

const TASHKEEL = /[ً-ٰٟـ]/g;

/** Harakat off, hamza/alef, yaa and taa-marbuta folded, so one spelling matches. */
export const fold = (s: string) =>
  s.replace(TASHKEEL, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');

/**
 * Titles about a topic these generators cannot produce — each word names a
 * lesson whose items would be about something else: estimating and rounding,
 * remainders, multiples, properties, money, equations, powers, divisibility,
 * skip-counting, fractions as parts or equivalents, mixed numbers, place-value
 * of decimals, conversions, negative integers.
 */
const UNSERVED = new RegExp([
  'تقدير', 'تقريب', 'خاصي', 'خصائص', 'خواص', 'باق', 'مضاعف', 'اولويات', 'نقود', 'معادلات',
  'القوي', 'الاسس', 'قابليه', 'القفزي', 'خطه', 'كجزء', 'متكافئ', 'خط الاعداد',
  'غير الفعلي', 'اجزاء', 'التحويل', 'صحيحه', 'المساويه', 'الحقائق', 'علاقه',
  'الذهني', 'كسري', 'التوزيع', 'قياس',
].join('|'));

/**
 * The operations a lesson is about, read from its TITLE — or `[]` when this
 * lesson has nothing the generators can honestly ask.
 *
 * Title, not the lesson's summary: the old version read every concept and
 * objective too, so a lesson on «الأنماط» whose summary said «جمع» served
 * addition, and «التحويل بين الكسور والأعداد العشرية» matched «كسور» and served
 * fraction addition. An empty list is a refusal, not a fallback — the caller
 * says there is no bank for the lesson rather than invent one.
 *
 * «جمع البيانات» is collecting data, not addition.
 */
export function elementaryOpsForTitle(title: string): ElementaryOp[] {
  const t = fold(title).replace(/جمع\s*البيانات|data\s*collection/gi, ' ');

  if (/مقارنه|ترتيب|compar|order/i.test(t)) {
    if (/صحيحه/.test(t)) return [];
    if (/كسور|كسر|fraction/i.test(t)) return ['frac_compare'];
    if (/عشري|decimal/i.test(t)) return ['dec_compare'];
    return /الاعداد|numbers/i.test(t) ? ['compare'] : [];
  }
  if (/مئوي|percent/i.test(t)) return /والكسور/.test(t) ? [] : ['percent'];
  if (UNSERVED.test(t)) return [];
  if (/منزلي|place\s*value/i.test(t)) return ['place'];

  const kind = /كسور|كسر|fraction/i.test(t) ? 'frac' : /عشري|decimal/i.test(t) ? 'dec' : 'whole';
  const named = {
    add: /جمع|addition|\badd/i.test(t),
    sub: /طرح|subtract/i.test(t),
    mul: /ضرب|multipl|times\s*table/i.test(t),
    div: /قسم|divi/i.test(t),
  };
  // Regrouping in a product is a two-digit factor, which the times-table items
  // are not.
  if (named.mul && /اعاده/.test(t)) return [];

  // «الكسور والقسمة» names a fraction and a division but is not dividing
  // fractions: an operation only counts when it is applied to the fractions.
  if (kind === 'frac' && !/(?:جمع|طرح|ضرب|قسم\S*)\s*(?:ال)?كسور/.test(t)) return [];

  const table: Record<typeof kind, Partial<Record<keyof typeof named, ElementaryOp>>> = {
    whole: { add: 'add', sub: 'sub', mul: 'mul', div: 'div' },
    frac: { add: 'frac', sub: 'frac_sub', mul: 'frac_mul', div: 'frac_div' },
    dec: { add: 'dec', sub: 'dec_sub', mul: 'dec_mul', div: 'dec_div' },
  };
  const ops: ElementaryOp[] = [];
  for (const key of ['add', 'sub', 'mul', 'div'] as const) {
    const op = table[kind][key];
    if (named[key] && op) ops.push(op);
  }
  return ops;
}

/**
 * The first operation a lesson is about, or null. Kept for callers that want
 * one; `elementaryOpsForTitle` is the whole answer.
 */
export function detectElementaryOp(blob: string): ElementaryOp | null {
  return elementaryOpsForTitle(blob)[0] ?? null;
}

/** Ops a grade can be asked when the lesson names none. */
const DEFAULT_OPS: Record<number, ElementaryOp[]> = {
  1: ['add', 'sub', 'compare'],
  2: ['add', 'sub', 'compare', 'place'],
  3: ['add', 'sub', 'mul', 'div'],
  4: ['add', 'sub', 'mul', 'div', 'frac'],
  5: ['mul', 'div', 'frac', 'dec'],
  6: ['frac', 'dec', 'percent', 'mul', 'div'],
};

/** Largest operand for + and −, by grade, then scaled by difficulty. */
const ADD_MAX: Record<number, number> = { 1: 20, 2: 999, 3: 9999, 4: 99999, 5: 999999, 6: 999999 };
/** Times tables for × and ÷ by grade (Grade 2 teaches 2–5). */
const TABLE_MAX: Record<number, number> = { 1: 2, 2: 5, 3: 10, 4: 10, 5: 10, 6: 10 };

const TIER_SCALE: Record<DiffTier, number> = { easy: 0.1, medium: 0.5, hard: 1 };

export type Rng = () => number;
export const int = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

/** Three distinct plausible wrong answers around a numeric answer. */
function numericWrongs(answer: number, rng: Rng, spread: number[]): string[] {
  const out = new Set<string>();
  for (const d of spread) {
    const w = answer + d;
    if (w >= 0 && w !== answer) out.add(String(w));
    if (out.size === 3) break;
  }
  let k = 2;
  while (out.size < 3) {
    const w = answer + (rng() < 0.5 ? -k : k);
    if (w >= 0 && w !== answer) out.add(String(w));
    k++;
  }
  return [...out].slice(0, 3);
}

export const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
export const frac = (n: number, d: number) => {
  const g = gcd(n, d);
  return d / g === 1 ? `${n / g}` : `${n / g}/${d / g}`;
};
/** Value of an "n/d" or whole-number string — distractors are deduped on this,
 *  not on text, or 4/12 sits beside the answer 1/3 as a second right option. */
const fracValue = (s: string) => {
  const [n, d] = s.split('/').map(Number);
  return d === undefined ? n : n / d;
};

/** «12.5» from 125 at one place; trailing zeros dropped. */
export const fixedDec = (n: number, places: number) => (n / 10 ** places).toFixed(places);
export const fmtDec = (n: number, places: number) => fixedDec(n, places).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');

/** Up to three distinct, non-negative decimals that are not the answer. */
function distinctDecimals(answer: string, candidates: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<number>([Number(answer)]);
  const take = (s: string) => {
    const v = Number(s);
    if (!Number.isFinite(v) || v < 0 || seen.has(v)) return;
    seen.add(v);
    out.push(s);
  };
  candidates.forEach(take);
  for (let k = 1; out.length < 3; k++) take(String(Math.round((Number(answer) + k) * 100) / 100));
  return out.slice(0, 3);
}

function decimalItem(
  base: Pick<ConcreteItem, 'id' | 'family' | 'diff'>, eq: string, r: number, places: number, wrongInts: number[],
): ConcreteItem {
  const answer = fmtDec(r, places);
  return { ...base, eq, answer, wrongs: distinctDecimals(answer, wrongInts.map(w => fmtDec(w, places))) };
}

/**
 * A fraction item whose three wrong options are never equal in value to the
 * answer (or to each other) — compared by value, not text, or 4/12 sits beside
 * the answer 1/3 as a second right option.
 */
function fractionItem(
  base: Pick<ConcreteItem, 'id' | 'family' | 'diff'>, eq: string, n: number, d: number, candidates: string[],
): ConcreteItem {
  const answer = frac(n, d);
  const seen = [fracValue(answer)];
  const wrongs: string[] = [];
  const take = (w: string) => {
    const v = fracValue(w);
    if (!Number.isFinite(v) || v <= 0 || seen.some(x => Math.abs(x - v) < 1e-9)) return;
    seen.push(v);
    wrongs.push(w);
  };
  candidates.forEach(take);
  for (let k = 1; wrongs.length < 3; k++) take(frac(n + k, d));
  return { ...base, eq, answer, wrongs: wrongs.slice(0, 3) };
}

/** a/d1 and b/d2 with different denominators — the unlike-denominator drill. */
function unlikePair(rng: Rng): [number, number, number, number] {
  const D = [2, 3, 4, 5, 6, 8, 10, 12];
  const d1 = D[int(rng, 0, D.length - 1)]!;
  let d2 = D[int(rng, 0, D.length - 1)]!;
  if (d2 === d1) d2 = D[(D.indexOf(d1) + 1) % D.length]!;
  return [int(rng, 1, d1 - 1), d1, int(rng, 1, d2 - 1), d2];
}

/**
 * The times table a lesson is about — «الضرب في 2», «القسمة على 5»,
 * "multiplying by 3" — or null. Such a lesson drills that table only.
 */
export function lessonTable(blob: string): number | null {
  const t = blob.replace(TASHKEEL, '');
  const m = t.match(/(?:ضرب|قسمة)\s*(?:في|على)\s*(\d{1,2})/) ?? t.match(/(?:multipl\w*|divid\w*)\s*by\s*(\d{1,2})/i);
  const n = m ? Number(m[1]) : NaN;
  return n >= 2 && n <= 12 ? n : null;
}

/** One item for `op` at `grade`/`diff`. `id` must be unique in the session. */
function build(op: ElementaryOp, grade: number, diff: DiffTier, rng: Rng, id: string, table: number | null): ConcreteItem {
  const base = { id, family: 'arith' as const, diff };
  const max = Math.max(10, Math.round(ADD_MAX[grade]! * TIER_SCALE[diff]));
  const tableMax = TABLE_MAX[grade]!;

  switch (op) {
    case 'add': {
      const a = int(rng, 1, max - 1);
      const b = int(rng, 1, Math.max(1, max - a));
      const s = a + b;
      return {
        ...base, eq: `${a} + ${b}`, answer: String(s),
        wrongs: numericWrongs(s, rng, max >= 100 ? [-10, 10, -1, 1, 100] : [-1, 1, -2, 2]),
        wordAr: `في مكتبة الصف ${a} قصة، وأضاف المعلم ${b} قصة أخرى. كم قصة أصبحت في المكتبة؟`,
        wordEn: `The class library has ${a} stories, and the teacher adds ${b} more. How many stories are there now?`,
      };
    }
    case 'sub': {
      const a = int(rng, 2, max);
      const b = int(rng, 1, a - 1);
      const d = a - b;
      return {
        ...base, eq: `${a} − ${b}`, answer: String(d),
        wrongs: numericWrongs(d, rng, max >= 100 ? [10, -10, 1, -1, 100] : [1, -1, 2, -2]),
        wordAr: `كان مع سامر ${a} ورقة ملونة، واستعمل منها ${b}. كم ورقة بقيت معه؟`,
        wordEn: `Sami had ${a} coloured sheets and used ${b}. How many are left?`,
      };
    }
    case 'mul': {
      // Grades 4+ go past the tables: a two-digit factor on medium/hard.
      const a = table ?? (grade >= 4 && diff !== 'easy' ? int(rng, 11, diff === 'hard' ? 99 : 30) : int(rng, 2, tableMax));
      const b = int(rng, 2, grade >= 5 && diff === 'hard' ? 99 : 10);
      const p = a * b;
      return {
        ...base, eq: `${a} × ${b}`, answer: String(p),
        wrongs: numericWrongs(p, rng, [a, -a, b, -b, 10]),
        wordAr: `في الصف ${a} صفوف من المقاعد، وفي كل صف ${b} مقاعد. كم مقعدًا في الصف؟`,
        wordEn: `A classroom has ${a} rows with ${b} seats each. How many seats are there?`,
      };
    }
    case 'div': {
      const b = table ?? int(rng, 2, tableMax);
      const q = table ? int(rng, 1, 10) : grade >= 4 && diff !== 'easy' ? int(rng, 11, diff === 'hard' ? 250 : 60) : int(rng, 1, 10);
      const a = b * q;
      return {
        ...base, eq: `${a} ÷ ${b}`, answer: String(q),
        wrongs: numericWrongs(q, rng, [1, -1, 2, b, -2]),
        wordAr: `وُزِّع ${a} قلمًا بالتساوي على ${b} مجموعات. كم قلمًا لكل مجموعة؟`,
        wordEn: `${a} pencils are shared equally among ${b} groups. How many does each group get?`,
      };
    }
    case 'compare': {
      const a = int(rng, 0, max);
      const b = rng() < 0.15 ? a : int(rng, 0, max);
      const sign = a > b ? '>' : a < b ? '<' : '=';
      return {
        ...base, eq: `${a} ___ ${b}`, answer: sign,
        wrongs: ['>', '<', '='].filter(s => s !== sign),
        promptAr: `ضع الإشارة المناسبة (> أو < أو =):\n${a} ___ ${b}`,
        promptEn: `Write the correct sign (>, < or =):\n${a} ___ ${b}`,
      };
    }
    case 'place': {
      const digits = Math.min(String(ADD_MAX[grade]).length, diff === 'easy' ? 2 : diff === 'medium' ? 3 : 4);
      const n = int(rng, 10 ** (digits - 1), 10 ** digits - 1);
      const s = String(n);
      const pos = int(rng, 0, s.length - 1);
      const digit = Number(s[pos]);
      const value = digit * 10 ** (s.length - 1 - pos);
      const wrongs = new Set<string>([String(digit), String(digit * 10 ** (s.length - pos)), String(Math.max(1, value / 10))]);
      wrongs.delete(String(value));
      while (wrongs.size < 3) wrongs.add(String(value + wrongs.size + 1));
      return {
        ...base, eq: s, answer: String(value), wrongs: [...wrongs].slice(0, 3),
        promptAr: `ما القيمة المنزلية للرقم ${digit} في العدد ${n}؟`,
        promptEn: `What is the place value of the digit ${digit} in ${n}?`,
      };
    }
    case 'frac': {
      if (grade <= 3) {
        // Unit fractions: the larger denominator is the smaller part.
        const d = int(rng, 2, 8);
        const e = int(rng, 2, 10);
        const d2 = e === d ? d + 1 : e;
        const sign = d < d2 ? '>' : '<';
        return {
          ...base, eq: `1/${d} ___ 1/${d2}`, answer: sign,
          wrongs: ['>', '<', '='].filter(s => s !== sign),
          promptAr: `ضع الإشارة المناسبة (> أو < أو =):\n1/${d} ___ 1/${d2}`,
          promptEn: `Write the correct sign (>, < or =):\n1/${d} ___ 1/${d2}`,
        };
      }
      if (grade >= 5) {
        const [a, d1, b, d2] = unlikePair(rng);
        const n = a * d2 + b * d1;
        const d = d1 * d2;
        return fractionItem(base, `${a}/${d1} + ${b}/${d2}`, n, d, [
          `${a + b}/${d1 + d2}`, `${a + b}/${d}`, frac(n + 1, d), frac(n, d + 1),
        ]);
      }
      const d = int(rng, 3, 12);
      const a = int(rng, 1, d - 2);
      const b = int(rng, 1, d - a - 1);
      return fractionItem(base, `${a}/${d} + ${b}/${d}`, a + b, d, [
        `${a + b}/${2 * d}`, frac(a + b + 1, d), `${a * b}/${d}`, `${a + b}/${d + 1}`,
      ]);
    }
    case 'frac_sub': {
      if (grade >= 5) {
        let [a, d1, b, d2] = unlikePair(rng);
        if (a * d2 < b * d1) [a, d1, b, d2] = [b, d2, a, d1];
        const n = a * d2 - b * d1;
        const d = d1 * d2;
        if (n > 0) {
          return fractionItem(base, `${a}/${d1} − ${b}/${d2}`, n, d, [
            `${a - b}/${d}`, `${a - b}/${d1 + d2}`, frac(n + 1, d), frac(n, d + 1),
          ]);
        }
      }
      const d = int(rng, 3, 12);
      const a = int(rng, 2, d - 1);
      const b = int(rng, 1, a - 1);
      return fractionItem(base, `${a}/${d} − ${b}/${d}`, a - b, d, [
        `${a - b}/${2 * d}`, frac(a - b + 1, d), `${a + b}/${d}`, `${a - b}/${d + 1}`,
      ]);
    }
    case 'frac_mul': {
      const [a, b, c, d] = [int(rng, 1, 5), int(rng, 2, 9), int(rng, 1, 5), int(rng, 2, 9)];
      return fractionItem(base, `${a}/${b} × ${c}/${d}`, a * c, b * d, [
        `${a * c}/${b + d}`, `${a + c}/${b * d}`, frac(a * d, b * c), frac(a * c, b * d + 1),
      ]);
    }
    case 'frac_div': {
      const [a, b, c, d] = [int(rng, 1, 5), int(rng, 2, 9), int(rng, 1, 5), int(rng, 2, 9)];
      return fractionItem(base, `${a}/${b} ÷ ${c}/${d}`, a * d, b * c, [
        frac(a * c, b * d), frac(b * c, a * d), `${a * d}/${b + c}`, frac(a * d + 1, b * c),
      ]);
    }
    case 'dec_sub': {
      const places = diff === 'hard' ? 2 : 1;
      const scale = 10 ** places;
      const A = int(rng, 2, 9 * scale);
      const B = int(rng, 1, A - 1);
      const r = A - B;
      return decimalItem(base, `${fmtDec(A, places)} − ${fmtDec(B, places)}`, r, places,
        [r + 1, r - 1, r + scale, r - scale]);
    }
    case 'dec_mul': {
      // One decimal place times a whole number: the point has one place in the
      // answer, and the classic slip is to move it.
      const A = int(rng, 11, 99);
      const b = int(rng, 2, 9);
      const P = A * b;
      return {
        ...base, eq: `${fmtDec(A, 1)} × ${b}`, answer: fmtDec(P, 1),
        wrongs: distinctDecimals(fmtDec(P, 1), [fmtDec(P, 2), fmtDec(P, 0), fmtDec(P + 1, 1), fmtDec(P - 1, 1)]),
      };
    }
    case 'dec_div': {
      const b = int(rng, 2, 9);
      const Q = int(rng, 11, 99);
      return {
        ...base, eq: `${fmtDec(Q * b, 1)} ÷ ${b}`, answer: fmtDec(Q, 1),
        wrongs: distinctDecimals(fmtDec(Q, 1), [fmtDec(Q, 2), fmtDec(Q, 0), fmtDec(Q + 1, 1), fmtDec(Q - 1, 1)]),
      };
    }
    case 'dec_compare': {
      // Different digit counts, so «0.5 ___ 0.45» is about place value and not
      // about which string is longer. One draw in four is an equal pair.
      const a = int(rng, 1, 9);
      const b = rng() < 0.25 ? a * 10 : int(rng, 1, 99);
      const sign = a * 10 > b ? '>' : a * 10 < b ? '<' : '=';
      return {
        ...base, eq: `${fixedDec(a, 1)} ___ ${fixedDec(b, 2)}`, answer: sign,
        wrongs: ['>', '<', '='].filter(s => s !== sign),
        promptAr: `ضع الإشارة المناسبة (> أو < أو =):\n${fixedDec(a, 1)} ___ ${fixedDec(b, 2)}`,
        promptEn: `Write the correct sign (>, < or =):\n${fixedDec(a, 1)} ___ ${fixedDec(b, 2)}`,
      };
    }
    case 'frac_compare': {
      // Different denominators, compared by cross-multiplying.
      let [n1, d1, n2, d2] = [0, 0, 0, 0];
      do {
        d1 = int(rng, 2, 12); d2 = int(rng, 2, 12);
        n1 = int(rng, 1, d1 - 1); n2 = int(rng, 1, d2 - 1);
      } while (d1 === d2 && n1 === n2);
      const l = n1 * d2;
      const r = n2 * d1;
      const sign = l > r ? '>' : l < r ? '<' : '=';
      return {
        ...base, eq: `${n1}/${d1} ___ ${n2}/${d2}`, answer: sign,
        wrongs: ['>', '<', '='].filter(x => x !== sign),
        promptAr: `ضع الإشارة المناسبة (> أو < أو =):
${n1}/${d1} ___ ${n2}/${d2}`,
        promptEn: `Write the correct sign (>, < or =):
${n1}/${d1} ___ ${n2}/${d2}`,
      };
    }
    case 'dec': {
      const places = diff === 'hard' ? 2 : 1;
      const scale = 10 ** places;
      const a = int(rng, 1, 9 * scale) / scale;
      const b = int(rng, 1, 9 * scale) / scale;
      const r = (x: number) => String(Math.round(x * scale) / scale);
      const s = (Math.round(a * scale) + Math.round(b * scale)) / scale;
      // Off by one place unit either way, and the classic slip of adding the
      // decimal parts as whole numbers (0.7 + 0.5 → 0.12).
      return {
        ...base, eq: `${a} + ${b}`, answer: r(s),
        wrongs: [r(s + 1 / scale), r(s - 1 / scale), r(s + 1)],
      };
    }
    case 'percent': {
      const p = [10, 20, 25, 50, 75][int(rng, 0, 4)]!;
      const n = int(rng, 1, diff === 'easy' ? 10 : 40) * 20;
      const v = (p * n) / 100;
      return {
        ...base, eq: `${p}% × ${n}`, answer: String(v),
        wrongs: numericWrongs(v, rng, [n / 10, -n / 10, p, n / 2 - v]),
        promptAr: `أوجد ${p}% من ${n}.`,
        promptEn: `Find ${p}% of ${n}.`,
      };
    }
  }
}

/**
 * A fresh item for a Grade 1–6 lesson. `used` holds stems already served this
 * pass; a draw that repeats one is retried, so a quiz never asks «7 + 5»
 * twice.
 */
export function makeElementaryItem(
  blob: string,
  grade: number,
  diff: DiffTier,
  used: Set<string>,
  rng: Rng = Math.random,
): ConcreteItem {
  const g = Math.min(6, Math.max(1, Math.round(grade)));
  const named = elementaryOpsForTitle(blob);
  const table = lessonTable(blob);
  const pool = named.length > 0 ? named : DEFAULT_OPS[g]!;
  let item: ConcreteItem | null = null;
  for (let attempt = 0; attempt < 25; attempt++) {
    const op = pool[int(rng, 0, pool.length - 1)]!;
    // The id's last digit decides a true/false item's claim (see
    // `formatItem`); a fixed suffix made every one of them «صح».
    item = build(op, g, diff, rng, `arith-${g}-${op}-${used.size}-${attempt}-${int(rng, 0, 9)}`, table);
    if (!used.has(`stem:${item.eq}`)) break;
  }
  used.add(`stem:${item!.eq}`);
  return item!;
}
