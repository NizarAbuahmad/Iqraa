/**
 * Grade 10 maths lessons that no banked family (`index.ts`) is about, and that
 * used to refuse with `NoQuestionBankError` (measured 2026-11-13):
 *
 *   • «حل معادلات خاصة»            (u1_l5, the book's opening lesson of unit 1)
 *   • «تمثيل الاقترانات المثلثية»   (u3_l3)
 *   • «حل مسائل ثلاثية الأبعاد»     (u4_l5)
 *   • «اقترانات كثيرات الحدود»      (u5_l1)
 *   • «الاقترانات النسبية»          (u5_l2, the guide calls it «قسمة كثيرات الحدود والاقترانات النسبية»)
 *
 * Same contract as `geometry.ts` (whose `bearing` and `sine_area` are the
 * precedent for a Grade 10 lesson with no family): the lesson TITLE picks the
 * generator, Grade 10 only, and every answer is computed from the numbers in
 * the stem. Nothing here is a typed key, and nothing carries a `check` — an
 * item is not "verified" because a generator produced it; `generated` is all
 * it ever is.
 *
 * Variables are latin `x` (the app turns them into «س» at display time), the
 * minus sign is the real «−», and a list of roots is written «−2 ، 0 ، 3» in
 * ascending order, so two lists are the same answer exactly when their text is.
 */
import { int, nz, pick, sfrac, signed, sup, tier, wrongsFrom, type Draft, type Rng, type Topic } from './topicKit.ts';

type D = 'easy' | 'medium' | 'hard';
type Gen = (c: { rng: Rng; diff: D; grade: number }) => Draft;
const T = (id: string, match: RegExp, grades: [number, number], make: Gen): Topic => ({ id, match, grades, make });

function shuffle<X>(rng: Rng, xs: readonly X[]): X[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = int(rng, 0, i); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}

// ─── polynomials as text ─────────────────────────────────────────────────────

/** `[coefficient, power]` terms in the order given, as «2x³ − x + 5»; no term is written for a zero coefficient. */
export function polyTerms(terms: ReadonlyArray<readonly [number, number]>): string {
  let out = '';
  for (const [c, deg] of terms) {
    if (c === 0) continue;
    const a = Math.abs(c);
    const body = deg === 0 ? String(a) : `${a === 1 ? '' : a}x${deg > 1 ? sup(deg) : ''}`;
    out += out === '' ? (c < 0 ? `−${body}` : body) : `${c < 0 ? ' − ' : ' + '}${body}`;
  }
  return out === '' ? '0' : out;
}

/** Coefficients from the highest power down → standard form. `poly([2, 0, −1, 5])` is «2x³ − x + 5». */
export function poly(coefs: readonly number[]): string {
  const n = coefs.length - 1;
  return polyTerms(coefs.map((c, i) => [c, n - i] as const));
}

/** Product of two polynomials, both highest power first. */
export function polyMul(a: readonly number[], b: readonly number[]): number[] {
  const out = new Array<number>(a.length + b.length - 1).fill(0);
  a.forEach((x, i) => b.forEach((y, j) => { out[i + j]! += x * y; }));
  return out;
}

const polyAdd = (a: readonly number[], b: readonly number[], sign: 1 | -1 = 1): number[] => {
  const n = Math.max(a.length, b.length);
  const pa = [...new Array<number>(n - a.length).fill(0), ...a];
  const pb = [...new Array<number>(n - b.length).fill(0), ...b];
  const out = pa.map((x, i) => x + sign * pb[i]!);
  while (out.length > 1 && out[0] === 0) out.shift();
  return out;
};

/** Value at `x` (Horner). */
export const polyAt = (coefs: readonly number[], x: number) => coefs.reduce((acc, c) => acc * x + c, 0);

/** Division by (x − r): the quotient and the remainder, highest power first. */
export function divideByLinear(coefs: readonly number[], r: number): { quotient: number[]; remainder: number } {
  const out: number[] = [];
  let carry = 0;
  coefs.forEach((c, i) => {
    carry = c + carry * r;
    if (i < coefs.length - 1) out.push(carry);
  });
  return { quotient: out, remainder: carry };
}

/** A list of values, once each, ascending: «−2 ، 0 ، 3». */
const roots = (xs: readonly number[]) => [...new Set(xs)].sort((a, b) => a - b).map(signed).join(' ، ');

/** `wrongsFrom` with a fallback that never runs dry for list-shaped answers. */
const wr = (answer: string, cands: ReadonlyArray<string | number>, near: (k: number) => string) => wrongsFrom(answer, [...cands], near);

/** «x − 3», «x + 4», or «x» for 0. */
const linear = (r: number) => poly([1, -r]);

const sq = (n: number) => n * n;

// ─── «حل معادلات خاصة» ───────────────────────────────────────────────────────

/**
 * The five things the book's lesson does (pp. 8–15): take out the greatest
 * common factor, group four terms, factor a sum or difference of cubes, treat
 * an equation as a quadratic in x² or x³ — and the box whose dimensions are
 * found from its volume. Every root list is the complete set of REAL roots,
 * and the key never lists a complex one.
 */
const specialEq = T('special_eq', /^حل معادلات خاصه$/, [10, 10], ({ rng, diff }) => {
  const t = tier(diff);
  const k = pick(rng, [0, 1, 2, 3, 4, 5]);

  if (k === 0) {
    // c·x^m·(x − p)(x − q) = 0, written out: the common factor c·x^m has to be taken out first
    const m = int(rng, 1, t === 2 ? 3 : 2);
    const c = pick(rng, t === 0 ? [1, 2] : [1, 2, 3, 4, 5]);
    const hi = 3 + 2 * t;
    const p = nz(rng, hi);
    let q = nz(rng, hi);
    while (q === p) q = nz(rng, hi);
    const f = poly([c, -c * (p + q), c * p * q, ...new Array<number>(m).fill(0)]);
    const answer = roots([0, p, q]);
    return {
      eq: `${f} = 0`, answer,
      wrongs: wr(answer, [roots([p, q]), roots([0, -p, -q]), roots([0, p]), roots([0, q]), roots([0, p, -q])], j => roots([0, p, q + j])),
      ar: `أوجد جميع الجذور الحقيقية للمعادلة: ${f} = 0`,
      en: `Find all the real roots of: ${f} = 0`,
    };
  }

  if (k === 1) {
    // grouping: x³ + a·x² − s²·x − a·s² = (x + a)(x² − s²)
    const c = pick(rng, t === 0 ? [1] : [1, 2, 3]);
    const s = int(rng, 1, 3 + t);
    let a = int(rng, 1, 3 + t);
    while (a === s) a = int(rng, 1, 3 + t);
    const f = poly([c, c * a, -c * sq(s), -c * a * sq(s)]);
    const answer = roots([-a, -s, s]);
    return {
      eq: `${f} = 0`, answer,
      wrongs: wr(answer, [roots([-a, s]), roots([a, -s, s]), roots([-a]), roots([a, s]), roots([-a, -sq(s), sq(s)])], j => roots([-a, -s, s + j])),
      ar: `أوجد جميع الجذور الحقيقية للمعادلة: ${f} = 0`,
      en: `Find all the real roots of: ${f} = 0`,
    };
  }

  if (k === 2) {
    // (m·x)³ ± p³ = 0: one real root, ∓p/m (the quadratic factor has a negative discriminant)
    const m = t === 0 ? 1 : pick(rng, [1, 2, 3]);
    const p = int(rng, 1, 3 + t);
    const plus = rng() < 0.5;
    const f = poly([m ** 3, 0, 0, plus ? p ** 3 : -(p ** 3)]);
    const n = plus ? -p : p; // the root is n/m
    const answer = sfrac(n, m);
    return {
      eq: `${f} = 0`, answer,
      wrongs: wr(answer, [sfrac(-n, m), sfrac(n * sq(p), m ** 3), sfrac(n * sq(p), m), sfrac(n, m ** 3), sfrac(n * m, 1)], j => sfrac(n + j, m)),
      ar: `ما الجذر الحقيقي للمعادلة ${f} = 0؟ (للمعادلة جذر حقيقي واحد فقط)`,
      en: `What is the real root of ${f} = 0? (It has only one real root.)`,
    };
  }

  if (k === 3) {
    // quadratic form: x⁴ − (a² + b²)x² + a²b² = 0, or x⁶ − (a³ + b³)x³ + a³b³ = 0
    if (t === 2 && rng() < 0.5) {
      const a = int(rng, 1, 2);
      const b = a + int(rng, 1, 3 - a);
      const f = poly([1, 0, 0, -(a ** 3 + b ** 3), 0, 0, (a * b) ** 3]);
      const answer = roots([a, b]);
      return {
        eq: `${f} = 0`, answer,
        wrongs: wr(answer, [roots([a ** 3, b ** 3]), roots([-a, -b]), roots([-b, -a, a, b]), roots([a, b ** 3]), roots([-b, b])], j => roots([a, b + j])),
        ar: `أوجد جميع الجذور الحقيقية للمعادلة: ${f} = 0`,
        en: `Find all the real roots of: ${f} = 0`,
      };
    }
    const a = int(rng, 1, 2 + t);
    const b = a + int(rng, 1, 2);
    const f = poly([1, 0, -(sq(a) + sq(b)), 0, sq(a) * sq(b)]);
    const answer = roots([-b, -a, a, b]);
    return {
      eq: `${f} = 0`, answer,
      wrongs: wr(answer, [roots([a, b]), roots([-b, -a]), roots([-a, a]), roots([-b, b]), roots([sq(a), sq(b), -sq(a), -sq(b)])], j => roots([-b - j, -a, a, b + j])),
      ar: `أوجد جميع الجذور الحقيقية للمعادلة: ${f} = 0`,
      en: `Find all the real roots of: ${f} = 0`,
    };
  }

  if (k === 4) {
    // how many different real roots: a factor x² + q contributes none
    const form = pick(rng, t === 0 ? [0, 1] : [0, 1, 2]);
    const q = int(rng, 1, 6);
    const r = int(rng, 1, 4);
    const p = nz(rng, 4);
    const coefs = form === 0 ? polyMul([1, -p], [1, 0, q]) : form === 1 ? [1, 0, -sq(r), 0] : polyMul([1, 0, -sq(r)], [1, 0, q]);
    const count = form === 0 ? 1 : form === 1 ? 3 : 2;
    const f = poly(coefs);
    const answer = String(count);
    return {
      eq: `${f} = 0`, answer,
      wrongs: wr(answer, [coefs.length - 1, count + 1, count - 1, 0, 1, 2, 3, 4].filter(v => v >= 0 && v !== count), j => String(count + Math.abs(j) + 1)),
      ar: `كم جذرًا حقيقيًّا مختلفًا للمعادلة: ${f} = 0؟`,
      en: `How many different real roots does ${f} = 0 have?`,
    };
  }

  // the book's box: length h − a, width h − b, height h, volume V (h is the only root above max(a, b))
  const a = int(rng, 1, 4 + 2 * t), b = int(rng, 1, 4 + 2 * t);
  const h = Math.max(a, b) + int(rng, 1, 5 + 3 * t);
  const V = h * (h - a) * (h - b);
  const answer = String(h);
  return {
    eq: `h(h − ${a})(h − ${b}) = ${V}`, answer,
    wrongs: wr(answer, [h - a, h - b, h + 1, h - 1, a + b, h + 2].map(String), j => String(h + j)),
    ar: `صندوق على شكل متوازي مستطيلات، طوله أقل من ارتفاعه بمقدار ${a} سم، وعرضه أقل من ارتفاعه بمقدار ${b} سم. إذا كان حجمه ${V} سم³ فما ارتفاعه بالسنتيمتر؟`,
    en: `A box is a cuboid. Its length is ${a} cm less than its height and its width is ${b} cm less than its height. If its volume is ${V} cm³, what is its height in centimetres?`,
  };
});

/** The generators of this file, in `topics.ts`'s table order. */
// Trig graphs, 3-D problems, polynomial and rational functions were also
// written here, in parallel with `grade10.ts` (merged first, 2026-11-13), which
// serves those four; only the book's «حل معادلات خاصة», a lesson that exists
// since this change, is generated here.
export const G10_TOPICS: readonly Topic[] = [specialEq];
