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

export type ElementaryOp = 'add' | 'sub' | 'mul' | 'div' | 'compare' | 'place' | 'frac' | 'frac_compare' | 'dec' | 'percent';

const TASHKEEL = /[ً-ٰٟـ]/g;

/**
 * The operation a lesson is about. Early-grade titles are fully vowelled
 * («الْجَمْعُ»), so harakat are stripped first. «جمع البيانات» is collecting
 * data, not addition.
 */
export function detectElementaryOp(blob: string): ElementaryOp | null {
  const t = blob.replace(TASHKEEL, '').replace(/جمع\s*البيانات|data\s*collection/gi, ' ');
  if (/مئوي|نسبة\s*مئوية|percent/i.test(t)) return 'percent';
  if (/كسر|كسور|fraction/i.test(t)) return /مقارن|ترتيب|compar|order/i.test(t) ? 'frac_compare' : 'frac';
  if (/عشري|decimal/i.test(t)) return 'dec';
  if (/طرح|subtract/i.test(t)) return 'sub';
  if (/قسمة|القسمة|divi/i.test(t)) return 'div';
  if (/ضرب|multipl|times\s*table/i.test(t)) return 'mul';
  if (/جمع|addition|\badd/i.test(t)) return 'add';
  if (/مقارن|ترتيب|compar|order/i.test(t)) return 'compare';
  if (/منزل|place\s*value|الآحاد|العشرات|المئات|الالوف|الألوف/i.test(t)) return 'place';
  return null;
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

type Rng = () => number;
const int = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

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

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const frac = (n: number, d: number) => {
  const g = gcd(n, d);
  return d / g === 1 ? `${n / g}` : `${n / g}/${d / g}`;
};
/** Value of an "n/d" or whole-number string — distractors are deduped on this,
 *  not on text, or 4/12 sits beside the answer 1/3 as a second right option. */
const fracValue = (s: string) => {
  const [n, d] = s.split('/').map(Number);
  return d === undefined ? n : n / d;
};

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
      const d = int(rng, grade <= 3 ? 2 : 3, grade <= 3 ? 8 : 12);
      if (grade <= 3) {
        // Unit fractions: the larger denominator is the smaller part.
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
      const a = int(rng, 1, d - 2);
      const b = int(rng, 1, d - a - 1);
      const answer = frac(a + b, d);
      const seen = [fracValue(answer)];
      const wrongs = [`${a + b}/${2 * d}`, frac(a + b + 1, d), `${a * b}/${d}`, `${a + b}/${d + 1}`, `${a + b + 2}/${d}`]
        .filter(w => {
          const v = fracValue(w);
          if (seen.some(x => Math.abs(x - v) < 1e-9)) return false;
          seen.push(v);
          return true;
        });
      return { ...base, eq: `${a}/${d} + ${b}/${d}`, answer, wrongs: wrongs.slice(0, 3) };
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
  const named = detectElementaryOp(blob);
  const table = lessonTable(blob);
  const pool = named ? [named] : DEFAULT_OPS[g]!;
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
