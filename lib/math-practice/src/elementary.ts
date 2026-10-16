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

// ─── Kinds of question ───────────────────────────────────────────────────────
//
// Each operation used to ask one sentence with new numbers — «أوجد ناتج: 2 × 6»
// twenty times — so a «الضرب في 2» paper had one kind of question on it
// (`stemFrame`). An operation now draws one of several kinds its lessons teach:
// the missing number, the related fact, a short word problem, ordering… Every
// answer is still computed from the numbers printed in the stem.

type Base = Pick<ConcreteItem, 'id' | 'family' | 'diff'>;

const choose = <T,>(rng: Rng, xs: readonly T[]): T => xs[int(rng, 0, xs.length - 1)]!;

/** An item whose stem is `ar` / `en`; a word problem also answers the word-problem format with itself. */
function ask(base: Base, eq: string, answer: string, wrongs: string[], ar: string, en: string, word = false): ConcreteItem {
  return word
    ? { ...base, eq, answer, wrongs, kind: 'word', wordAr: ar, wordEn: en }
    : { ...base, eq, answer, wrongs, promptAr: ar, promptEn: en };
}
const withText = (item: ConcreteItem, ar: string, en: string, word = false): ConcreteItem =>
  ask(item, item.eq, item.answer, item.wrongs, ar, en, word);

/** Three distinct whole-number wrongs: the plausible slips first, then neighbours. */
function wrongNums(answer: number, rng: Rng, slips: number[]): string[] {
  const out = new Set<string>();
  for (const w of slips) {
    if (out.size === 3) break;
    if (Number.isInteger(w) && w >= 0 && w !== answer) out.add(String(w));
  }
  for (const w of numericWrongs(answer, rng, [1, -1, 2, -2, 10])) if (out.size < 3) out.add(w);
  return [...out];
}

/** The first three candidates that are neither the answer nor each other. */
const wrongStrs = (answer: string, candidates: string[]) =>
  [...new Set(candidates.filter(c => c !== answer))].slice(0, 3);

/** Jordanian first names; the verbs of a word problem agree with the name's gender. */
const BOYS = ['أحمد', 'عمر', 'يزن', 'زيد', 'سامر', 'خالد'] as const;
const GIRLS = ['سلمى', 'ليلى', 'رنا', 'تالا', 'هيا', 'جود'] as const;
const EN_NAME: Record<string, string> = {
  أحمد: 'Ahmad', عمر: 'Omar', يزن: 'Yazan', زيد: 'Zaid', سامر: 'Samer', خالد: 'Khaled',
  سلمى: 'Salma', ليلى: 'Layla', رنا: 'Rana', تالا: 'Tala', هيا: 'Haya', جود: 'Joud',
};

/**
 * A counted noun's forms: after 100, 1000… (and 101, 102) the singular, the
 * dual (in the case the sentence needs, written without the digit), after 3–10
 * the plural, after 11–99 the accusative singular.
 */
interface Noun { sg: string; du: string; pl: string; acc: string }
const noun = (sg: string, du: string, pl: string, acc: string): Noun => ({ sg, du, pl, acc });
const DINAR = noun('دينار', 'ديناران', 'دنانير', 'دينارًا');
const BOOK = noun('كتاب', 'كتابان', 'كتب', 'كتابًا');
const CARD = noun('بطاقة', 'بطاقتان', 'بطاقات', 'بطاقة');
const VISITOR = noun('زائر', 'زائران', 'زوار', 'زائرًا');
const PEN = noun('قلم', 'قلمان', 'أقلام', 'قلمًا');
const TREE = noun('شجرة', 'شجرتان', 'أشجار', 'شجرة');
const ROW = noun('صف', 'صفّان', 'صفوف', 'صفًّا');
const SQUARE = noun('مربع', 'مربعان', 'مربعات', 'مربعًا');
const BOX = noun('علبة', 'علبتان', 'علب', 'علبة');
const EGG = noun('بيضة', 'بيضتان', 'بيضات', 'بيضة');
const CAKE = noun('كعكة', 'كعكتان', 'كعكات', 'كعكة');
const APPLE = noun('تفاحة', 'تفاحتان', 'تفاحات', 'تفاحة');
const LITRE = noun('لتر', 'لتران', 'لترات', 'لترًا');
const STUDENT = noun('طالب', 'طالبان', 'طلاب', 'طالبًا');
/** Genitive dual: «على طالبَين». */
const STUDENT_GEN = noun('طالب', 'طالبَين', 'طلاب', 'طالبًا');
const SCHOOL_GEN = noun('مدرسة', 'مدرستَين', 'مدارس', 'مدرسة');

/** «n noun» as Arabic counts it. `n` is at least 2 — no word problem here counts one thing. */
function counted(n: number, w: Noun): string {
  if (n === 2) return w.du;
  const r = n % 100;
  if (r >= 3 && r <= 10) return `${n} ${w.pl}`;
  if (r >= 11) return `${n} ${w.acc}`;
  return `${n} ${w.sg}`;
}

const listAr = (xs: readonly (string | number)[]) => xs.join('، ');
const listEn = (xs: readonly (string | number)[]) => xs.join(', ');
const q = (s: string) => s.replace(/؟/g, '?');

const PLACE_AR = ['الآحاد', 'العشرات', 'المئات', 'الألوف'];
const PLACE_EN = ['ones', 'tens', 'hundreds', 'thousands'];

/** «345» → «300 + 40 + 5», zero digits left out. */
const expanded = (digits: number[]) =>
  digits.map((d, i) => d * 10 ** (digits.length - 1 - i)).filter(v => v > 0).join(' + ');

/** Three numbers (or fractions, decimals) to order: the key and three wrong orders. */
function orderItem(
  base: Base, values: number[], show: (v: number) => string, up: boolean,
  what: { ar: string; en: string },
): ConcreteItem {
  const asc = [...values].sort((x, y) => x - y).map(show);
  const key = up ? asc : [...asc].reverse();
  const swap = (xs: string[], i: number) => { const ys = [...xs]; [ys[i], ys[i + 1]] = [ys[i + 1]!, ys[i]!]; return ys; };
  const shown = values.map(show);
  return ask(base, `order:${up ? 'up' : 'down'}:${shown.join(',')}`, listAr(key),
    [[...key].reverse(), swap(key, 0), swap(key, 1)].map(listAr),
    `رتّب ${what.ar} الآتية ${up ? 'تصاعديًّا' : 'تنازليًّا'}: ${listAr(shown)}`,
    `Order these ${what.en} from ${up ? 'least to greatest' : 'greatest to least'}: ${listEn(shown)}`);
}

/** The greatest (or least) of four values; the other three are the wrong options. */
function extremeItem(
  base: Base, values: number[], show: (v: number) => string, greatest: boolean,
  what: { ar: string; one: string; en: string },
): ConcreteItem {
  const best = greatest ? Math.max(...values) : Math.min(...values);
  const shown = values.map(show);
  return ask(base, `${greatest ? 'max' : 'min'}:${shown.join(',')}`, show(best),
    values.filter(v => v !== best).map(show),
    `ما ${what.one} ${greatest ? 'الأكبر' : 'الأصغر'} بين ${what.ar} الآتية: ${listAr(shown)}؟`,
    `Which is the ${greatest ? 'greatest' : 'least'} of these ${what.en}: ${listEn(shown)}?`);
}

/** `k` distinct whole numbers in [lo, hi]. */
function distinctInts(rng: Rng, k: number, lo: number, hi: number): number[] {
  const out = new Set<number>();
  for (let t = 0; out.size < k && t < 200; t++) out.add(int(rng, lo, hi));
  for (let v = lo; out.size < k; v++) out.add(v);
  return [...out];
}

/** `k` fractions of distinct value, as [n, d]. Grade 3 compares unit fractions or one denominator. */
function distinctFractions(rng: Rng, k: number, grade: number): Array<[number, number]> {
  const mode = choose(rng, grade <= 3 ? ['unit', 'like'] as const : ['unit', 'like', 'unlike'] as const);
  const like = int(rng, 5, 12);
  const out: Array<[number, number]> = [];
  const seen: number[] = [];
  for (let t = 0; out.length < k && t < 500; t++) {
    const d = mode === 'like' ? like : int(rng, 2, 12);
    const n = mode === 'unit' ? 1 : int(rng, 1, d - 1);
    if (seen.some(v => Math.abs(v - n / d) < 1e-9)) continue;
    seen.push(n / d);
    out.push([n, d]);
  }
  return out;
}

/** A tenths or hundredths count whose last digit is not 0, so «7.5 دينار» never prints as «7 دينار». */
function decimalCount(rng: Rng, lo: number, hi: number): number {
  const n = int(rng, lo, hi);
  return n % 10 === 0 ? n + 1 : n;
}

const lcm = (a: number, b: number) => (a * b) / gcd(a, b);

// ── whole numbers ──

function addKinds(base: Base, max: number, rng: Rng): ConcreteItem {
  const a = int(rng, 1, max - 1);
  const b = int(rng, 1, Math.max(1, max - a));
  const s = a + b;
  switch (int(rng, 1, 4)) {
    case 1: {
      // The missing addend: «7 + ؟ = 15».
      const left = rng() < 0.5;
      const ans = left ? a : b;
      const eq = left ? `؟ + ${b} = ${s}` : `${a} + ؟ = ${s}`;
      return ask(base, eq, String(ans), wrongNums(ans, rng, [s, s + (left ? b : a), ans + 1, ans - 1]),
        `أوجد العدد المجهول: ${eq}`, `Find the missing number: ${q(eq)}`);
    }
    case 2: {
      // Three addends (Grade 1 «جمع ثلاثة أعداد» makes ten first).
      const x = int(rng, 1, Math.max(1, Math.floor(max / 2)));
      const y = int(rng, 1, Math.max(1, Math.floor((max - x) / 2)));
      const z = int(rng, 1, Math.max(1, max - x - y));
      const t = x + y + z;
      const eq = `${x} + ${y} + ${z}`;
      return ask(base, eq, String(t), wrongNums(t, rng, [x + y, y + z, t + 1, t - 1, t + 10]),
        `أوجد ناتج جمع الأعداد الثلاثة: ${eq}`, `Add the three numbers: ${eq}`);
    }
    case 3: {
      const x = int(rng, 3, Math.max(3, max - 3));
      const y = int(rng, 3, Math.max(3, max - x));
      const t = x + y;
      const wr = wrongNums(t, rng, [Math.abs(x - y), t + 10, t - 10, t + 1, t - 1]);
      const eq = `word:${x} + ${y}`;
      if (max <= 100) {
        if (rng() < 0.5) {
          const girl = rng() < 0.5;
          const name = girl ? choose(rng, GIRLS) : choose(rng, BOYS);
          const [her, father] = girl ? ['ها', 'والدها'] : ['ه', 'والده'];
          return ask(base, eq, String(t), wr,
            `كان مع ${name} ${counted(x, DINAR)}، وأعطا${her} ${father} ${counted(y, DINAR)}. كم دينارًا أصبح مع${her}؟`,
            `${EN_NAME[name]} had ${x} dinars and was given ${y} more. How many dinars does ${girl ? 'she' : 'he'} have now?`, true);
        }
        return ask(base, eq, String(t), wr,
          `في مكتبة الصف ${counted(x, BOOK)}، ثم أهدى أولياء الأمور المكتبة ${counted(y, BOOK)}. كم كتابًا أصبح في المكتبة؟`,
          `The class library has ${x} books, and parents give it ${y} more. How many books does it have now?`, true);
      }
      if (rng() < 0.5) {
        return ask(base, eq, String(t), wr,
          `زار مدينة البتراء يوم الجمعة ${counted(x, VISITOR)}، وزارها يوم السبت ${counted(y, VISITOR)}. كم زائرًا زار البتراء في اليومين؟`,
          `Petra had ${x} visitors on Friday and ${y} on Saturday. How many visitors came over the two days?`, true);
      }
      return ask(base, eq, String(t), wr,
        `جمعت مدرسة في حملة خيرية ${counted(x, DINAR)} في الأسبوع الأول، و${counted(y, DINAR)} في الأسبوع الثاني. كم دينارًا جمعت في الأسبوعين؟`,
        `A school's charity drive raised ${x} dinars in the first week and ${y} in the second. How much did it raise in the two weeks?`, true);
    }
    default: {
      // The related subtraction fact.
      return ask(base, `${a} + ${b} = ${s} → ${s} − ${b}`, String(a), wrongNums(a, rng, [s, b, s + b, a + 1]),
        `إذا كان ${a} + ${b} = ${s}، فما ناتج ${s} − ${b}؟`,
        `If ${a} + ${b} = ${s}, what is ${s} − ${b}?`);
    }
  }
}

function subKinds(base: Base, max: number, rng: Rng): ConcreteItem {
  const a = int(rng, 2, max);
  const b = int(rng, 1, a - 1);
  const d = a - b;
  switch (int(rng, 1, 4)) {
    case 1: {
      // The missing subtrahend or minuend.
      if (rng() < 0.5) {
        const eq = `${a} − ؟ = ${d}`;
        return ask(base, eq, String(b), wrongNums(b, rng, [a + d, d, b + 1, b - 1]),
          `أوجد العدد المجهول: ${eq}`, `Find the missing number: ${q(eq)}`);
      }
      const eq = `؟ − ${b} = ${d}`;
      return ask(base, eq, String(a), wrongNums(a, rng, [Math.abs(d - b), d, a + 1, a - 1]),
        `أوجد العدد المجهول: ${eq}`, `Find the missing number: ${q(eq)}`);
    }
    case 2:
    case 3: {
      const x = int(rng, 6, Math.max(6, max));
      const y = int(rng, 3, x - 3);
      const t = x - y;
      const wr = wrongNums(t, rng, [x + y, t + 10, t - 10, t + 1, t - 1]);
      const eq = `word:${x} − ${y}`;
      const girl = rng() < 0.5;
      const name = girl ? choose(rng, GIRLS) : choose(rng, BOYS);
      if (max <= 100) {
        if (rng() < 0.5) {
          // Taking away.
          return ask(base, eq, String(t), wr,
            `كان مع ${name} ${counted(x, CARD)}، ${girl ? 'فأعطت صديقتها' : 'فأعطى صديقه'} ${counted(y, CARD)}. كم بطاقة بقيت مع${girl ? 'ها' : 'ه'}؟`,
            `${EN_NAME[name]} had ${x} cards and gave ${y} to a friend. How many cards are left?`, true);
        }
        // Comparing: how many more.
        const boy = choose(rng, BOYS);
        return ask(base, eq, String(t), wr,
          `ادّخر ${boy} ${counted(x, DINAR)}، وادّخرت أخته ${counted(y, DINAR)}. بكم دينارًا يزيد ما ادّخره ${boy} على ما ادّخرته أخته؟`,
          `${EN_NAME[boy]} saved ${x} dinars and his sister saved ${y}. How many more dinars did ${EN_NAME[boy]} save?`, true);
      }
      if (rng() < 0.5) {
        return ask(base, eq, String(t), wr,
          `في مستودع مكتبة ${counted(x, BOOK)}، بِيع منها ${counted(y, BOOK)}. كم كتابًا بقي في المستودع؟`,
          `A bookshop's store has ${x} books and ${y} are sold. How many books are left in the store?`, true);
      }
      return ask(base, eq, String(t), wr,
        `زار مدينة جرش يوم الجمعة ${counted(x, VISITOR)}، وزارها يوم السبت ${counted(y, VISITOR)}. بكم زائرًا يزيد عدد زوار يوم الجمعة على عدد زوار يوم السبت؟`,
        `Jerash had ${x} visitors on Friday and ${y} on Saturday. How many more visitors came on Friday?`, true);
    }
    default:
      // Checking a subtraction by addition.
      return ask(base, `${a} − ${b} = ${d} → ${d} + ${b}`, String(a), wrongNums(a, rng, [d, b, a + b, a + 1, a - 1]),
        `إذا كان ${a} − ${b} = ${d}، فما ناتج ${d} + ${b}؟`,
        `If ${a} − ${b} = ${d}, what is ${d} + ${b}?`);
  }
}

function mulKinds(base: Base, a: number, bMax: number, rng: Rng): ConcreteItem {
  switch (int(rng, 1, 3)) {
    case 1: {
      // The missing factor; the lesson's table stays the known one.
      const b = int(rng, 2, bMax);
      const p = a * b;
      const eq = rng() < 0.5 ? `${a} × ؟ = ${p}` : `؟ × ${a} = ${p}`;
      return ask(base, eq, String(b), wrongNums(b, rng, [b + 1, b - 1, p - a, a]),
        `أوجد العدد المجهول: ${eq}`, `Find the missing number: ${q(eq)}`);
    }
    case 2: {
      // Repeated addition is multiplication: how many groups?
      const n = int(rng, 3, 6);
      const sum = Array.from({ length: n }, () => String(a)).join(' + ');
      const eq = `${sum} = ؟ × ${a}`;
      return ask(base, eq, String(n), wrongNums(n, rng, [n + 1, n - 1, n * a, a]),
        `أكمل بالعدد المناسب: ${eq}`, `Fill in the missing number: ${q(eq)}`);
    }
    default: {
      const b = int(rng, 3, Math.max(3, bMax));
      const p = a * b;
      const wr = wrongNums(p, rng, [a + b, p + a, p - a, p + 10]);
      const eq = `word:${b} × ${a}`;
      const t = int(rng, 0, 2);
      if (t === 0) {
        return ask(base, eq, String(p), wr,
          `زرع مزارع ${counted(b, ROW)} من أشجار الزيتون، في كل صف ${counted(a, TREE)}. كم شجرة زرع؟`,
          `A farmer planted ${b} rows of olive trees with ${a} trees in each row. How many trees did he plant?`, true);
      }
      if (t === 1) {
        const girl = choose(rng, GIRLS);
        return ask(base, eq, String(p), wr,
          `اشترت ${girl} ${counted(b, BOX)} من الأقلام، في كل علبة ${counted(a, PEN)}. كم قلمًا اشترت؟`,
          `${EN_NAME[girl]} bought ${b} boxes of pens with ${a} pens in each box. How many pens did she buy?`, true);
      }
      return ask(base, eq, String(p), wr,
        `شبكة مربعات فيها ${counted(b, ROW)}، في كل صف ${counted(a, SQUARE)}. كم مربعًا في الشبكة؟`,
        `A grid has ${b} rows with ${a} squares in each row. How many squares are in the grid?`, true);
    }
  }
}

function divKinds(base: Base, b: number, q0: number, grade: number, diff: DiffTier, rng: Rng): ConcreteItem {
  const a = b * q0;
  switch (int(rng, 1, 5)) {
    case 1: {
      // The missing divisor or dividend.
      if (rng() < 0.5) {
        const eq = `${a} ÷ ؟ = ${q0}`;
        return ask(base, eq, String(b), wrongNums(b, rng, [q0, a - q0, b + 1, b - 1]),
          `أوجد العدد المجهول: ${eq}`, `Find the missing number: ${q(eq)}`);
      }
      const eq = `؟ ÷ ${b} = ${q0}`;
      return ask(base, eq, String(a), wrongNums(a, rng, [q0 + b, a + b, a - b, q0]),
        `أوجد العدد المجهول: ${eq}`, `Find the missing number: ${q(eq)}`);
    }
    case 2:
      // The related multiplication fact.
      return ask(base, `${b} × ${q0} = ${a} → ${a} ÷ ${b}`, String(q0), wrongNums(q0, rng, [a, b, q0 + 1, q0 - 1]),
        `إذا كان ${b} × ${q0} = ${a}، فما ناتج ${a} ÷ ${b}؟`,
        `If ${b} × ${q0} = ${a}, what is ${a} ÷ ${b}?`);
    case 3:
    case 4: {
      // Sharing equally, or making equal groups. At least two in each share.
      const qq = Math.max(2, q0 > 60 ? int(rng, 11, 60) : q0);
      const n = b * qq;
      const wr = wrongNums(qq, rng, [n - b, n + b, qq + 1, qq - 1, b]);
      const eq = `word:${n} ÷ ${b}`;
      if (rng() < 0.5) {
        if (n <= 100) {
          return ask(base, eq, String(qq), wr,
            `وزّعت المعلمة ${counted(n, PEN)} على ${counted(b, STUDENT_GEN)} بالتساوي. كم قلمًا يأخذ كل طالب؟`,
            `The teacher shares ${n} pens equally among ${b} students. How many pens does each student get?`, true);
        }
        return ask(base, eq, String(qq), wr,
          `وُزِّع ${counted(n, BOOK)} على ${counted(b, SCHOOL_GEN)} بالتساوي. كم كتابًا تأخذ كل مدرسة؟`,
          `${n} books are shared equally among ${b} schools. How many books does each school get?`, true);
      }
      return ask(base, eq, String(qq), wr,
        `وضع مزارع ${counted(n, EGG)} في أطباق، في كل طبق ${counted(b, EGG)}. كم طبقًا ملأ؟`,
        `A farmer packs ${n} eggs into trays of ${b}. How many trays does he fill?`, true);
    }
    default: {
      if (grade <= 3) {
        // Division as repeated subtraction (Grade 2 «القسمة كطرح متكرر»).
        const qq = Math.min(10, Math.max(2, q0));
        const n = b * qq;
        return ask(base, `repeat:${n} − ${b}`, String(qq), wrongNums(qq, rng, [qq + 1, qq - 1, n - b, b]),
          `كم مرة نطرح العدد ${b} من العدد ${n} حتى نصل إلى الصفر؟`,
          `How many times can you subtract ${b} from ${n} until you reach zero?`);
      }
      // What the remainder means: a part-filled box is still a box.
      const per = int(rng, 4, 9);
      const full = int(rng, 5, diff === 'hard' ? 99 : 30);
      const n = per * full + int(rng, 1, per - 1);
      const ans = full + 1;
      return ask(base, `ceil:${n} ÷ ${per}`, String(ans), wrongNums(ans, rng, [full, n - per * full, full + 2]),
        `يريد بائع وضع ${counted(n, CAKE)} في علب، تتسع كل علبة لـ ${counted(per, CAKE)}. ما أقل عدد من العلب يحتاج إليه؟`,
        `A baker wants to pack ${n} cakes into boxes that hold ${per} each. What is the least number of boxes he needs?`, true);
    }
  }
}

function compareKinds(base: Base, max: number, rng: Rng): ConcreteItem {
  const show = (v: number) => String(v);
  const what = { ar: 'الأعداد', one: 'العدد', en: 'numbers' };
  const k = int(rng, 1, 3);
  if (k === 1) return orderItem(base, distinctInts(rng, 3, 0, max), show, rng() < 0.5, what);
  if (k === 2 || max < 100) return extremeItem(base, distinctInts(rng, 4, 0, max), show, rng() < 0.5, what);
  // The greatest / least number made from given digits — place value deciding order.
  const L = Math.min(4, String(max).length);
  const digits = distinctInts(rng, L, 1, 9);
  const big = rng() < 0.5;
  const desc = [...digits].sort((x, y) => y - x);
  const asc = [...desc].reverse();
  const key = big ? desc : asc;
  const swap = (xs: number[], i: number) => { const ys = [...xs]; [ys[i], ys[i + 1]] = [ys[i + 1]!, ys[i]!]; return ys.join(''); };
  return ask(base, `digits:${big ? 'max' : 'min'}:${digits.join(',')}`, key.join(''),
    wrongStrs(key.join(''), [(big ? asc : desc).join(''), swap(key, L - 2), swap(key, 0)]),
    `ما ${big ? 'أكبر' : 'أصغر'} عدد يمكن تكوينه من الأرقام ${listAr(digits)}، إذا استُعمل كل رقم مرة واحدة؟`,
    `What is the ${big ? 'greatest' : 'least'} number you can make from the digits ${listEn(digits)}, using each digit once?`);
}

function placeKinds(base: Base, digits: number, rng: Rng): ConcreteItem {
  switch (int(rng, 1, 3)) {
    case 1: {
      // Write a number in expanded form (no zero digits, so the form is unique).
      const ds = Array.from({ length: digits }, () => int(rng, 1, 9));
      const n = Number(ds.join(''));
      const key = expanded(ds);
      const rev = [...ds].reverse();
      const swapped = [...ds];
      [swapped[digits - 2], swapped[digits - 1]] = [swapped[digits - 1]!, swapped[digits - 2]!];
      return ask(base, `expand:${n}`, key, wrongStrs(key, [
        ds.join(' + '),
        ds.map((d, i) => d * 10 ** (digits - i)).join(' + '),
        expanded(rev),
        expanded(swapped),
        ds.map(d => d * 10 ** (digits - 1)).join(' + '),
      ]),
        `اكتب العدد ${n} بالصورة التحليلية.`, `Write ${n} in expanded form.`);
    }
    case 2: {
      // The digit in a named place.
      const n = int(rng, 10 ** (digits - 1), 10 ** digits - 1);
      const s = String(n);
      const p = int(rng, 0, digits - 1);
      const digit = Number(s[digits - 1 - p]);
      const others = [...s].map(Number).filter((_, i) => i !== digits - 1 - p);
      return ask(base, `digit:${p}:${n}`, String(digit), wrongNums(digit, rng, [digit * 10 ** p, ...others]),
        `ما الرقم في منزلة ${PLACE_AR[p]} في العدد ${n}؟`,
        `Which digit is in the ${PLACE_EN[p]} place of ${n}?`);
    }
    default: {
      // From expanded form back to the number; a zero digit is the classic slip.
      let ds: number[] = [];
      for (let t = 0; t < 50; t++) {
        ds = [int(rng, 1, 9), ...Array.from({ length: digits - 1 }, () => (rng() < 0.25 ? 0 : int(rng, 1, 9)))];
        if (ds.filter(d => d > 0).length >= 2) break;
      }
      if (ds.filter(d => d > 0).length < 2) ds[digits - 1] = 1;
      const n = Number(ds.join(''));
      const terms = expanded(ds);
      return ask(base, `standard:${terms}`, String(n), wrongNums(n, rng, [
        Number(ds.filter(d => d > 0).join('')),
        Number([...ds].reverse().join('')),
        n + 10 ** (digits - 1),
        n + 10,
      ]),
        `اكتب العدد الذي صورته التحليلية: ${terms}`, `Write the number whose expanded form is ${terms}.`);
    }
  }
}

// ── fractions ──

function fracCompareKinds(base: Base, grade: number, rng: Rng): ConcreteItem {
  // Values map back to the fraction as drawn (not simplified), e.g. 2/4.
  const shownFracs = new Map<number, string>();
  const show = (v: number) => shownFracs.get(v) ?? String(v);
  const take = (k: number) => distinctFractions(rng, k, grade).map(([n, d]) => { shownFracs.set(n / d, `${n}/${d}`); return n / d; });
  const what = { ar: 'الكسور', one: 'الكسر', en: 'fractions' };
  if (rng() < 0.5) return orderItem(base, take(3), show, rng() < 0.5, what);
  return extremeItem(base, take(4), show, rng() < 0.5, what);
}

function fracAddKinds(base: Base, grade: number, rng: Rng): ConcreteItem {
  const unlike = grade >= 5;
  const [a, d1, b, d2] = unlike ? unlikePair(rng) : (() => {
    const d = int(rng, 3, 12);
    const x = int(rng, 1, d - 2);
    return [x, d, int(rng, 1, d - x - 1), d] as [number, number, number, number];
  })();
  const sn = a * d2 + b * d1;
  const sd = d1 * d2;
  const S = unlike ? frac(sn, sd) : `${a + b}/${d1}`;
  switch (int(rng, 1, 3)) {
    case 1: {
      const eq = `${a}/${d1} + ؟ = ${S}`;
      return withText(fractionItem(base, eq, b, d2, [S, `${a}/${d1}`, frac(b + 1, d2)]),
        `أوجد العدد المجهول: ${eq}`, `Find the missing number: ${q(eq)}`);
    }
    case 2: {
      const item = fractionItem(base, `word:${a}/${d1} + ${b}/${d2}`, sn, sd, [`${a + b}/${d1 + d2}`, frac(Math.abs(a * d2 - b * d1), sd), frac(sn + 1, sd)]);
      if (sn <= sd && rng() < 0.5) {
        const boy = choose(rng, BOYS);
        return withText(item,
          `أكل ${boy} ${a}/${d1} البيتزا، وأكلت أخته ${b}/${d2} منها. ما الكسر الذي أكلاه معًا من البيتزا؟`,
          `${EN_NAME[boy]} ate ${a}/${d1} of a pizza and his sister ate ${b}/${d2} of it. What fraction of the pizza did they eat together?`, true);
      }
      const girl = choose(rng, GIRLS);
      return withText(item,
        `اشترت ${girl} ${a}/${d1} كغ من التفاح، و${b}/${d2} كغ من البرتقال. كم كيلوغرامًا اشترت؟`,
        `${EN_NAME[girl]} bought ${a}/${d1} kg of apples and ${b}/${d2} kg of oranges. How many kilograms did she buy?`, true);
    }
    default: {
      if (unlike) {
        // The least common denominator — the first step of adding unlike fractions.
        const m = lcm(d1, d2);
        return ask(base, `lcd:${a}/${d1},${b}/${d2}`, String(m), wrongNums(m, rng, [d1 * d2, d1 + d2, Math.max(d1, d2), 2 * m]),
          `ما المقام المشترك الأصغر للكسرين ${a}/${d1} و ${b}/${d2}؟`,
          `What is the least common denominator of ${a}/${d1} and ${b}/${d2}?`);
      }
      // Three like fractions.
      const d = int(rng, 4, 12);
      const x = int(rng, 1, d - 3);
      const y = int(rng, 1, d - x - 2);
      const z = int(rng, 1, d - x - y - 1);
      return withText(fractionItem(base, `${x}/${d} + ${y}/${d} + ${z}/${d}`, x + y + z, d, [`${x + y + z}/${3 * d}`, frac(x + y, d), frac(x + y + z + 1, d)]),
        `ما مجموع الكسور ${x}/${d} و ${y}/${d} و ${z}/${d}؟`,
        `What is the sum of ${x}/${d}, ${y}/${d} and ${z}/${d}?`);
    }
  }
}

function fracSubKinds(base: Base, grade: number, rng: Rng): ConcreteItem {
  let [a, d1, b, d2] = [0, 0, 0, 0];
  let unlike = false;
  if (grade >= 5) {
    [a, d1, b, d2] = unlikePair(rng);
    if (a * d2 < b * d1) [a, d1, b, d2] = [b, d2, a, d1];
    unlike = a * d2 - b * d1 > 0;
  }
  if (!unlike) {
    const d = int(rng, 3, 12);
    a = int(rng, 2, d - 1);
    b = int(rng, 1, a - 1);
    d1 = d2 = d;
  }
  const dn = a * d2 - b * d1;
  const dd = d1 * d2;
  const D = unlike ? frac(dn, dd) : `${a - b}/${d1}`;
  switch (int(rng, 1, 3)) {
    case 1: {
      const eq = `${a}/${d1} − ؟ = ${D}`;
      return withText(fractionItem(base, eq, b, d2, [D, `${a}/${d1}`, frac(a * d2 + dn, dd)]),
        `أوجد العدد المجهول: ${eq}`, `Find the missing number: ${q(eq)}`);
    }
    case 2: {
      const boy = choose(rng, BOYS);
      return withText(fractionItem(base, `word:${a}/${d1} − ${b}/${d2}`, dn, dd, [frac(Math.abs(a - b), Math.abs(d1 - d2) || d1), frac(a * d2 + b * d1, dd), frac(dn + 1, dd)]),
        `في إبريق ${a}/${d1} لتر من الحليب، شرب ${boy} منه ${b}/${d2} لتر. كم لترًا بقي في الإبريق؟`,
        `A jug holds ${a}/${d1} litre of milk and ${EN_NAME[boy]} drinks ${b}/${d2} litre. How much milk is left?`, true);
    }
    default:
      return withText(fractionItem(base, `more:${a}/${d1} − ${b}/${d2}`, dn, dd, [frac(a * d2 + b * d1, dd), frac(Math.abs(a - b), Math.abs(d1 - d2) || d1), frac(dn + 1, dd)]),
        `بكم يزيد الكسر ${a}/${d1} على الكسر ${b}/${d2}؟`,
        `How much greater is ${a}/${d1} than ${b}/${d2}?`);
  }
}

function fracMulKinds(base: Base, rng: Rng): ConcreteItem {
  switch (int(rng, 1, 3)) {
    case 1: {
      // A fraction of a quantity.
      const b = int(rng, 2, 9);
      const a = int(rng, 1, b - 1);
      const m = int(rng, Math.ceil(10 / b), Math.max(Math.ceil(10 / b), Math.floor(40 / b)));
      const n = b * m;
      const ans = a * m;
      return ask(base, `of:${a}/${b} × ${n}`, String(ans), wrongNums(ans, rng, [n - ans, m, n * a, ans + m]),
        `في صف ${counted(n, STUDENT)}، ${a}/${b} منهم يمارسون الرياضة. كم طالبًا يمارس الرياضة؟`,
        `A class has ${n} students and ${a}/${b} of them play sport. How many students play sport?`, true);
    }
    case 2: {
      // Area of a rectangle with fraction sides.
      const [a, b, c, d] = [int(rng, 1, 4), int(rng, 5, 9), int(rng, 1, 4), int(rng, 2, 9)];
      const [c2, d2] = c < d ? [c, d] : [1, d];
      return withText(fractionItem(base, `area:${a}/${b} × ${c2}/${d2}`, a * c2, b * d2, [`${a * c2}/${b + d2}`, frac(a * d2, b * c2), frac(a * d2 + c2 * b, b * d2)]),
        `قطعة قماش مستطيلة الشكل طولها ${a}/${b} م، وعرضها ${c2}/${d2} م. ما مساحتها بالمتر المربع؟`,
        `A rectangular piece of cloth is ${a}/${b} m long and ${c2}/${d2} m wide. What is its area in square metres?`, true);
    }
    default: {
      // The missing factor.
      const [a, b, c, d] = [int(rng, 1, 5), int(rng, 2, 9), int(rng, 1, 5), int(rng, 2, 9)];
      const P = frac(a * c, b * d);
      const eq = `${a}/${b} × ؟ = ${P}`;
      return withText(fractionItem(base, eq, c, d, [P, frac(d, c), frac(c + 1, d), frac(c, d + 1)]),
        `أوجد العدد المجهول: ${eq}`, `Find the missing number: ${q(eq)}`);
    }
  }
}

/** Grade 3 «الكسور والقسمة»: a unit fraction of a two-digit number, found by dividing. */
function unitFractionOf(base: Base, rng: Rng): ConcreteItem {
  const d = int(rng, 2, 10);
  const qq = int(rng, Math.max(2, Math.ceil(10 / d)), 9);
  const n = d * qq;
  switch (int(rng, 0, 2)) {
    case 0:
      return ask(base, `unit:1/${d} × ${n}`, String(qq), wrongNums(qq, rng, [d, n - qq, qq + 1, qq - 1]),
        `أوجد 1/${d} العدد ${n}.`, `Find 1/${d} of ${n}.`);
    case 1: {
      const girl = choose(rng, GIRLS);
      return ask(base, `unitword:1/${d} × ${n}`, String(qq), wrongNums(qq, rng, [n - qq, d, qq + 1, qq - 1]),
        `عند ${girl} ${counted(n, APPLE)}، أعطت 1/${d} منها لأخيها. كم تفاحة أعطت أخاها؟`,
        `${EN_NAME[girl]} has ${n} apples and gives 1/${d} of them to her brother. How many apples does she give him?`, true);
    }
    default:
      return ask(base, `unitdiv:1/${d} × ${n}`, String(d), wrongNums(d, rng, [qq, n, d + 1, d - 1]),
        `أكمل: 1/${d} العدد ${n} = ${n} ÷ ؟`, `Complete: 1/${d} of ${n} = ${n} ÷ ?`);
  }
}

function fracDivKinds(base: Base, rng: Rng): ConcreteItem {
  switch (int(rng, 1, 3)) {
    case 1: {
      // The reciprocal — what dividing by a fraction multiplies by.
      let [a, b] = [int(rng, 1, 8), int(rng, 2, 9)];
      if (a === b || gcd(a, b) !== 1) [a, b] = [1, b];
      return withText(fractionItem(base, `recip:${a}/${b}`, b, a, [`${a}/${b}`, frac(1, b), frac(b + 1, a)]),
        `ما مقلوب الكسر ${a}/${b}؟`, `What is the reciprocal of ${a}/${b}?`);
    }
    case 2: {
      // A whole number divided by a unit fraction.
      const n = int(rng, 3, 9);
      const k = int(rng, 2, 5);
      const girl = choose(rng, GIRLS);
      return ask(base, `cups:${n} ÷ 1/${k}`, String(n * k), wrongNums(n * k, rng, [n + k, n * k + k, n * k - k, k]),
        `لدى ${girl} ${counted(n, LITRE)} من العصير، تريد أن تسكبها في أكواب سعة كل منها 1/${k} لتر. كم كوبًا تملأ؟`,
        `${EN_NAME[girl]} has ${n} litres of juice to pour into cups that hold 1/${k} litre each. How many cups does she fill?`, true);
    }
    default: {
      // A fraction divided by a whole number.
      const [a, b, n] = [int(rng, 1, 5), int(rng, 2, 9), int(rng, 2, 6)];
      return withText(fractionItem(base, `bywhole:${a}/${b} ÷ ${n}`, a, b * n, [frac(a * n, b), frac(a, b + n), frac(n, a * b)]),
        `أوجد ناتج قسمة الكسر ${a}/${b} على العدد ${n}.`, `Divide the fraction ${a}/${b} by ${n}.`);
    }
  }
}

// ── decimals ──

function decCompareKinds(base: Base, rng: Rng): ConcreteItem {
  // Hundredths around one whole number, so the digits after the point decide.
  const w = int(rng, 0, 9);
  const show = (v: number) => fmtDec(v, 2);
  const what = { ar: 'الأعداد العشرية', one: 'العدد', en: 'decimals' };
  if (rng() < 0.5) return orderItem(base, distinctInts(rng, 3, w * 100 + 1, w * 100 + 99), show, rng() < 0.5, what);
  return extremeItem(base, distinctInts(rng, 4, w * 100 + 1, w * 100 + 99), show, rng() < 0.5, what);
}

function decAddKinds(base: Base, diff: DiffTier, rng: Rng): ConcreteItem {
  const places = diff === 'hard' ? 2 : 1;
  const scale = 10 ** places;
  const A = decimalCount(rng, scale + 1, 9 * scale);
  const B = decimalCount(rng, scale + 1, 9 * scale);
  const S = A + B;
  if (rng() < 0.5) {
    const eq = `${fmtDec(A, places)} + ؟ = ${fmtDec(S, places)}`;
    return withText(decimalItem(base, eq, B, places, [S, B + 1, B - 1, B + scale]),
      `أوجد العدد المجهول: ${eq}`, `Find the missing number: ${q(eq)}`);
  }
  const girl = choose(rng, GIRLS);
  return withText(decimalItem(base, `word:${fmtDec(A, places)} + ${fmtDec(B, places)}`, S, places, [S + 1, S - 1, S + scale, Math.abs(A - B)]),
    `اشترت ${girl} دفترًا بـ ${fmtDec(A, places)} دينار، وقلمًا بـ ${fmtDec(B, places)} دينار. كم دينارًا دفعت؟`,
    `${EN_NAME[girl]} bought a notebook for ${fmtDec(A, places)} dinars and a pen for ${fmtDec(B, places)} dinars. How much did she pay?`, true);
}

function decSubKinds(base: Base, diff: DiffTier, rng: Rng): ConcreteItem {
  const places = diff === 'hard' ? 2 : 1;
  const scale = 10 ** places;
  const A = decimalCount(rng, 2 * scale + 1, 9 * scale);
  const B = decimalCount(rng, 1, A - scale - 1);
  const D = A - B;
  if (rng() < 0.5) {
    const eq = `${fmtDec(A, places)} − ؟ = ${fmtDec(D, places)}`;
    return withText(decimalItem(base, eq, B, places, [A + D, D, B + 1, B + scale]),
      `أوجد العدد المجهول: ${eq}`, `Find the missing number: ${q(eq)}`);
  }
  const boy = choose(rng, BOYS);
  return withText(decimalItem(base, `word:${fmtDec(A, places)} − ${fmtDec(B, places)}`, D, places, [A + B, D + 1, D - 1, D + scale]),
    `كان مع ${boy} ${fmtDec(A, places)} دينار، اشترى منها كتابًا بـ ${fmtDec(B, places)} دينار. كم دينارًا بقي معه؟`,
    `${EN_NAME[boy]} had ${fmtDec(A, places)} dinars and bought a book for ${fmtDec(B, places)} dinars. How much money is left?`, true);
}

const FRUIT: Array<[string, string]> = [['الموز', 'bananas'], ['التفاح', 'apples'], ['العنب', 'grapes'], ['البرتقال', 'oranges']];

function decMulKinds(base: Base, diff: DiffTier, rng: Rng): ConcreteItem {
  switch (int(rng, 1, 3)) {
    case 1: {
      // × 10, 100, 1000: the point moves right.
      const k = int(rng, 1, 3);
      const A = decimalCount(rng, 101, 9999);
      const p = 10 ** k;
      // Slips: the point moved one place too few or too many, or the wrong way.
      const key = fmtDec(A * p, 2);
      return ask(base, `shift:${fmtDec(A, 2)} × ${p}`, key,
        distinctDecimals(key, [fmtDec(A * 10 ** (k - 1), 2), fmtDec(A * 10 ** (k + 1), 2), ...(k <= 2 ? [fmtDec(A, 2 + k)] : [])]),
        `اضرب العدد ${fmtDec(A, 2)} في ${p}.`, `Multiply ${fmtDec(A, 2)} by ${p}.`);
    }
    case 2: {
      // Decimal × decimal: the places add.
      const X = decimalCount(rng, 11, 99);
      const Y = diff === 'hard' ? decimalCount(rng, 11, 49) : int(rng, 2, 9);
      const P = X * Y;
      const key = fmtDec(P, 2);
      return ask(base, `dd:${fmtDec(X, 1)} × ${fmtDec(Y, 1)}`, key, distinctDecimals(key, [fmtDec(P, 1), fmtDec(P, 3), fmtDec(P + 10, 2)]),
        `أوجد ناتج ضرب العددين العشريين ${fmtDec(X, 1)} و ${fmtDec(Y, 1)}.`,
        `Multiply the decimals ${fmtDec(X, 1)} and ${fmtDec(Y, 1)}.`);
    }
    default: {
      const A = decimalCount(rng, 11, 49);
      const n = int(rng, 2, 9);
      const [ar, en] = choose(rng, FRUIT);
      return withText(decimalItem(base, `kg:${fmtDec(A, 1)} × ${n}`, A * n, 1, [A * n * 10, A * n + 1, A * n - 1, A + n * 10]),
        `ثمن الكيلوغرام الواحد من ${ar} ${fmtDec(A, 1)} دينار. ما ثمن ${n} كغ منه بالدينار؟`,
        `One kilogram of ${en} costs ${fmtDec(A, 1)} dinars. How many dinars do ${n} kg cost?`, true);
    }
  }
}

function decDivKinds(base: Base, diff: DiffTier, rng: Rng): ConcreteItem {
  switch (int(rng, 1, 3)) {
    case 1: {
      // ÷ 10, 100, 1000: the point moves left.
      const k = int(rng, 1, 3);
      const A = decimalCount(rng, 11, 999);
      const p = 10 ** k;
      const key = fmtDec(A, 1 + k);
      return ask(base, `shift:${fmtDec(A, 1)} ÷ ${p}`, key,
        distinctDecimals(key, [fmtDec(A, k), ...(k <= 2 ? [fmtDec(A, 2 + k)] : []), fmtDec(A * p, 1), fmtDec(A, 1)]),
        `اقسم العدد ${fmtDec(A, 1)} على ${p}.`, `Divide ${fmtDec(A, 1)} by ${p}.`);
    }
    case 2: {
      // Decimal ÷ decimal, with a whole-number quotient.
      const D = diff === 'hard' ? decimalCount(rng, 11, 49) : int(rng, 2, 9);
      const qq = int(rng, 2, 30);
      return ask(base, `dd:${fmtDec(qq * D, 1)} ÷ ${fmtDec(D, 1)}`, String(qq),
        distinctDecimals(String(qq), [fmtDec(qq, 1), String(qq * 10), String(qq + 1)]),
        `ما ناتج قسمة العدد العشري ${fmtDec(qq * D, 1)} على العدد العشري ${fmtDec(D, 1)}؟`,
        `What is ${fmtDec(qq * D, 1)} ÷ ${fmtDec(D, 1)}?`);
    }
    default: {
      // Unit price: the total's last digit is never 0, so «دينار» always agrees.
      const n = choose(rng, [3, 7, 9]);
      const A = int(rng, 1, 4) * 10 + choose(rng, [1, 3, 7, 9]);
      const [ar, en] = choose(rng, FRUIT);
      const boy = choose(rng, BOYS);
      return withText(decimalItem(base, `kg:${fmtDec(n * A, 1)} ÷ ${n}`, A, 1, [A * 10, A + 1, A - 1, n * A]),
        `اشترى ${boy} ${n} كغ من ${ar} بـ ${fmtDec(n * A, 1)} دينار. ما ثمن الكيلوغرام الواحد بالدينار؟`,
        `${EN_NAME[boy]} bought ${n} kg of ${en} for ${fmtDec(n * A, 1)} dinars. How many dinars does one kilogram cost?`, true);
    }
  }
}

function percentKinds(base: Base, diff: DiffTier, rng: Rng): ConcreteItem {
  switch (int(rng, 1, 3)) {
    case 1: {
      const p = choose(rng, [5, 10, 20, 25, 40, 50, 60, 75, 80]);
      return withText(fractionItem(base, `pfrac:${p}%`, p, 100, [frac(100 - p, 100), `1/${p}`, frac(p, 10)]),
        `اكتب ${p}% على صورة كسر في أبسط صورة.`, `Write ${p}% as a fraction in simplest form.`);
    }
    case 2: {
      // A hundred-square: the shaded part as a percentage.
      let p = int(rng, 3, 97);
      if (p === 50) p = 45;
      const alt = p + 10 > 97 ? p - 10 : p + 10;
      return ask(base, `grid:${p}`, `${p}%`, wrongStrs(`${p}%`, [`${100 - p}%`, `${fmtDec(p, 1)}%`, `${alt}%`, `${p + 1}%`]),
        `لُوِّن ${counted(p, SQUARE)} من شبكة مكوّنة من 100 مربع. ما النسبة المئوية للجزء الملوّن؟`,
        `${p} squares of a 100-square grid are shaded. What percentage is shaded?`);
    }
    default: {
      const p = choose(rng, [10, 20, 25, 50, 75]);
      if (rng() < 0.5) {
        const n = int(rng, 1, diff === 'easy' ? 10 : 40) * 20;
        const v = (p * n) / 100;
        return ask(base, `walk:${p}% × ${n}`, String(v), wrongNums(v, rng, [n - v, p, n / 10, v + n / 10]),
          `في مدرسة ${counted(n, STUDENT)}، ${p}% منهم يأتون إلى المدرسة مشيًا. كم طالبًا يأتي مشيًا؟`,
          `A school has ${n} students and ${p}% of them walk to school. How many students walk?`, true);
      }
      const n = int(rng, 1, 10) * 20;
      const v = (p * n) / 100;
      return ask(base, `sale:${p}% × ${n}`, String(v), wrongNums(v, rng, [n - v, p, n / 10, v + n / 10]),
        `سعر حقيبة ${counted(n, DINAR)}، وعليها خصم ${p}%. كم دينارًا قيمة الخصم؟`,
        `A bag costs ${n} dinars and has a ${p}% discount. How many dinars is the discount?`, true);
    }
  }
}

/** One item for `op` at `grade`/`diff`. `id` must be unique in the session. */
function build(op: ElementaryOp, grade: number, diff: DiffTier, rng: Rng, id: string, table: number | null): ConcreteItem {
  const base = { id, family: 'arith' as const, diff };
  const max = Math.max(10, Math.round(ADD_MAX[grade]! * TIER_SCALE[diff]));
  const tableMax = TABLE_MAX[grade]!;

  switch (op) {
    case 'add': {
      if (int(rng, 0, 4) > 0) return addKinds(base, max, rng);
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
      if (int(rng, 0, 4) > 0) return subKinds(base, max, rng);
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
      const bMax = grade >= 5 && diff === 'hard' ? 99 : 10;
      if (int(rng, 0, 3) > 0) return mulKinds(base, a, bMax, rng);
      const b = int(rng, 2, bMax);
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
      if (int(rng, 0, 5) > 0) return divKinds(base, b, q, grade, diff, rng);
      const a = b * q;
      return {
        ...base, eq: `${a} ÷ ${b}`, answer: String(q),
        wrongs: numericWrongs(q, rng, [1, -1, 2, b, -2]),
        wordAr: `وُزِّع ${a} قلمًا بالتساوي على ${b} مجموعات. كم قلمًا لكل مجموعة؟`,
        wordEn: `${a} pencils are shared equally among ${b} groups. How many does each group get?`,
      };
    }
    case 'compare': {
      if (int(rng, 0, 3) > 0) return compareKinds(base, max, rng);
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
      if (int(rng, 0, 3) > 0) return placeKinds(base, digits, rng);
      // The digit asked about must occur once: «الرقم 4 في العدد 344» has two
      // place values and no single answer.
      let n = 0;
      let s = '';
      let once: number[] = [];
      for (let t = 0; t < 50 && once.length === 0; t++) {
        n = int(rng, 10 ** (digits - 1), 10 ** digits - 1);
        s = String(n);
        once = [...s].flatMap((c, i) => (s.indexOf(c) === s.lastIndexOf(c) ? [i] : []));
      }
      if (once.length === 0) { n = Number('1234'.slice(0, digits)); s = String(n); once = [0]; }
      const pos = choose(rng, once);
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
      if (grade >= 4 && int(rng, 0, 3) > 0) return fracAddKinds(base, grade, rng);
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
      if (int(rng, 0, 3) > 0) return fracSubKinds(base, grade, rng);
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
      if (int(rng, 0, 3) > 0) return fracMulKinds(base, rng);
      const [a, b, c, d] = [int(rng, 1, 5), int(rng, 2, 9), int(rng, 1, 5), int(rng, 2, 9)];
      return fractionItem(base, `${a}/${b} × ${c}/${d}`, a * c, b * d, [
        `${a * c}/${b + d}`, `${a + c}/${b * d}`, frac(a * d, b * c), frac(a * c, b * d + 1),
      ]);
    }
    case 'frac_div': {
      // Grade 3 «الكسور والقسمة» is a unit fraction OF a number, not dividing
      // fractions — «2/6 ÷ 3/2» is Grade 5 work.
      if (grade <= 3) return unitFractionOf(base, rng);
      if (int(rng, 0, 3) > 0) return fracDivKinds(base, rng);
      const [a, b, c, d] = [int(rng, 1, 5), int(rng, 2, 9), int(rng, 1, 5), int(rng, 2, 9)];
      return fractionItem(base, `${a}/${b} ÷ ${c}/${d}`, a * d, b * c, [
        frac(a * c, b * d), frac(b * c, a * d), `${a * d}/${b + c}`, frac(a * d + 1, b * c),
      ]);
    }
    case 'dec_sub': {
      if (int(rng, 0, 2) > 0) return decSubKinds(base, diff, rng);
      const places = diff === 'hard' ? 2 : 1;
      const scale = 10 ** places;
      const A = int(rng, 2, 9 * scale);
      const B = int(rng, 1, A - 1);
      const r = A - B;
      return decimalItem(base, `${fmtDec(A, places)} − ${fmtDec(B, places)}`, r, places,
        [r + 1, r - 1, r + scale, r - scale]);
    }
    case 'dec_mul': {
      if (int(rng, 0, 3) > 0) return decMulKinds(base, diff, rng);
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
      if (int(rng, 0, 3) > 0) return decDivKinds(base, diff, rng);
      const b = int(rng, 2, 9);
      const Q = int(rng, 11, 99);
      return {
        ...base, eq: `${fmtDec(Q * b, 1)} ÷ ${b}`, answer: fmtDec(Q, 1),
        wrongs: distinctDecimals(fmtDec(Q, 1), [fmtDec(Q, 2), fmtDec(Q, 0), fmtDec(Q + 1, 1), fmtDec(Q - 1, 1)]),
      };
    }
    case 'dec_compare': {
      if (int(rng, 0, 2) > 0) return decCompareKinds(base, rng);
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
      if (int(rng, 0, 2) > 0) return fracCompareKinds(base, grade, rng);
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
      if (int(rng, 0, 2) > 0) return decAddKinds(base, diff, rng);
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
      if (int(rng, 0, 3) > 0) return percentKinds(base, diff, rng);
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
