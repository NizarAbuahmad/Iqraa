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

// ─── «تمثيل الاقترانات المثلثية» ──────────────────────────────────────────────

const RAD = Math.PI / 180;
const trigFn = { sin: Math.sin, cos: Math.cos, tan: Math.tan } as const;
type TrigName = keyof typeof trigFn;

/** Whole degrees in [0, 360] at which `fn` takes `v` (never at a place `tan` is undefined). */
function degreesWhere(fn: TrigName, v: number): number[] {
  const out: number[] = [];
  for (let d = 0; d <= 360; d++) {
    if (fn === 'tan' && (d === 90 || d === 270)) continue;
    if (Math.abs(trigFn[fn](d * RAD) - v) < 1e-9) out.push(d);
  }
  return out;
}

/** Where `fn` is strictly positive (or negative) on [0°, 360°], as the intervals a book writes: «0° ≤ x < 90° ∪ 270° < x ≤ 360°». */
function signIntervals(fn: TrigName, positive: boolean): string {
  const ok = (d: number) => {
    if (d < 0 || d > 360 || (fn === 'tan' && (d === 90 || d === 270))) return false;
    const v = trigFn[fn](d * RAD);
    return positive ? v > 1e-9 : v < -1e-9;
  };
  const runs: Array<[number, number]> = [];
  let start: number | null = null;
  for (let d = 0; d <= 361; d++) {
    if (ok(d) && start === null) start = d;
    if (!ok(d) && start !== null) { runs.push([start, d - 1]); start = null; }
  }
  // a run of whole degrees a..b is the open interval (a − 1, b + 1), closed only where the domain itself ends
  return runs
    .map(([a, b]) => `${a === 0 ? '0° ≤ x' : `${a - 1}° < x`} ${b === 360 ? '≤ 360°' : `< ${b + 1}°`}`)
    .join(' ∪ ');
}

const halfStr = (v: number) => (v === 0 ? '0' : signed(v));
const eqHalf = (fn: TrigName, v: number) => `${fn} x = ${v < 0 ? '−' : ''}${Math.abs(v)}`;

const trigGraph = T('trig_graph', /^تمثيل الاقترانات المثلثيه$/, [10, 10], ({ rng, diff }) => {
  const t = tier(diff);
  const k = pick(rng, t === 0 ? [0, 1, 2, 5, 5] : t === 1 ? [0, 1, 2, 3, 4, 5] : [0, 1, 3, 3, 4, 2]);
  const DOMAIN_AR = 'الفترة 0° ≤ x ≤ 360°';
  const DOMAIN_EN = '0° ≤ x ≤ 360°';

  if (k === 0) {
    // greatest / least value of a·sin x or a·cos x
    const fn = pick(rng, ['sin', 'cos'] as const);
    const a = pick(rng, t === 0 ? [1, 2, 3] : [2, 3, 4, 5]);
    const neg = t > 0 && rng() < 0.4;
    const high = rng() < 0.5;
    const fx = `${neg ? '−' : ''}${a === 1 ? '' : `${a} `}${fn} x`;
    // the greatest value of ±a·f is a and the least is −a, because f runs over [−1, 1]
    const best = high ? a : -a;
    const answer = signed(best);
    return {
      eq: `y = ${fx}`, answer,
      wrongs: wr(answer, [signed(-best), signed(best + 1), signed(best - 1), '0', signed(2 * best), '1'], j => signed(best + j)),
      ar: `ما القيمة ${high ? 'العظمى' : 'الصغرى'} للاقتران y = ${fx} في ${DOMAIN_AR}؟`,
      en: `What is the ${high ? 'greatest' : 'least'} value of y = ${fx} for ${DOMAIN_EN}?`,
    };
  }

  if (k === 1) {
    // where the function is positive / negative
    const fn = pick(rng, ['sin', 'cos', 'tan'] as const);
    const positive = rng() < 0.5;
    const answer = signIntervals(fn, positive);
    const all: string[] = [];
    for (const f2 of ['sin', 'cos', 'tan'] as const) for (const p2 of [true, false]) all.push(signIntervals(f2, p2));
    const same = signIntervals(fn, !positive);
    const others = shuffle(rng, all.filter(s => s !== answer && s !== same));
    return {
      eq: `${fn} x ${positive ? '> 0' : '< 0'}`, answer,
      wrongs: wr(answer, [same, ...others], () => same),
      ar: `في ${DOMAIN_AR}، متى يكون ${fn} x ${positive ? 'موجبًا' : 'سالبًا'}؟`,
      en: `For ${DOMAIN_EN}, when is ${fn} x ${positive ? 'positive' : 'negative'}?`,
    };
  }

  if (k === 2) {
    // how many times the graph meets the x-axis (the table of values: where y = 0)
    const fn = pick(rng, ['sin', 'cos', 'tan'] as const);
    const count = degreesWhere(fn, 0).length;
    const answer = String(count);
    return {
      eq: `${fn} x = 0`, answer,
      wrongs: wr(answer, [count + 1, count - 1, 0, 1, 2, 3, 4].filter(v => v >= 0 && v !== count).map(String), j => String(count + Math.abs(j) + 1)),
      ar: `كم مرة يقطع منحنى الاقتران y = ${fn} x المحور x في ${DOMAIN_AR}؟`,
      en: `How many times does the graph of y = ${fn} x cross the x-axis for ${DOMAIN_EN}?`,
    };
  }

  if (k === 3) {
    // the two angles in [0°, 360°] with a given value (the book's exercises 5, 6, 13)
    const choices: Array<[TrigName, number]> = [['sin', 0.5], ['sin', -0.5], ['cos', 0.5], ['cos', -0.5], ['tan', 1], ['tan', -1]];
    const [fn, v] = pick(rng, choices);
    const pairOf = (f2: TrigName, v2: number) => degreesWhere(f2, v2).map(d => `${d}°`).join(' ، ');
    const answer = pairOf(fn, v);
    const rest = shuffle(rng, choices.filter(([f2, v2]) => !(f2 === fn && v2 === v)).map(([f2, v2]) => pairOf(f2, v2)));
    return {
      eq: eqHalf(fn, v), answer,
      wrongs: wr(answer, rest, j => `${Math.abs(j) * 15}° ، ${360 - Math.abs(j) * 15}°`),
      ar: `أجد قيمتَي x في ${DOMAIN_AR} اللتين يكون عندهما ${eqHalf(fn, v)}.`,
      en: `Find the two values of x for ${DOMAIN_EN} at which ${eqHalf(fn, v)}.`,
    };
  }

  if (k === 4) {
    // the vertical asymptotes of y = tan x: where cos x = 0
    const at = degreesWhere('cos', 0).map(d => `x = ${d}°`).join(' ، ');
    const answer = at;
    return {
      eq: 'tan x asymptotes', answer,
      wrongs: ['x = 0° ، x = 180°', 'x = 180° ، x = 360°', 'x = 45° ، x = 225°', 'x = 135° ، x = 315°'],
      ar: `ما معادلتا خطّي التقارب الرأسيّين لمنحنى الاقتران y = tan x في ${DOMAIN_AR}؟`,
      en: `What are the two vertical asymptotes of the graph of y = tan x for ${DOMAIN_EN}?`,
    };
  }

  // a value read off the book's table of values
  const fn = pick(rng, ['sin', 'cos'] as const);
  const angles = fn === 'sin' ? [0, 30, 90, 150, 180, 210, 270, 330, 360] : [0, 60, 90, 120, 180, 240, 270, 300, 360];
  const d = pick(rng, angles);
  const v = Math.round(trigFn[fn](d * RAD) * 2) / 2 + 0;
  const answer = halfStr(v);
  const rest = shuffle(rng, [-1, -0.5, 0, 0.5, 1].filter(x => x !== v)).map(halfStr);
  return {
    eq: `${fn} ${d}°`, answer,
    wrongs: wr(answer, rest, j => String(j)),
    ar: `من جدول القيم والتمثيل البياني للاقتران y = ${fn} x، ما قيمة ${fn} ${d}°؟`,
    en: `From the table of values and graph of y = ${fn} x, what is ${fn} ${d}°?`,
  };
});

// ─── «حل مسائل ثلاثية الأبعاد» ─────────────────────────────────────────────────

/** a ≤ b ≤ c with √(a² + b² + c²) a whole number — the edges of a cuboid whose space diagonal is also whole. */
const CUBOIDS: Array<[number, number, number, number]> = [];
for (let a = 1; a <= 12; a++) for (let b = a; b <= 12; b++) for (let c = b; c <= 12; c++) {
  const d = Math.sqrt(a * a + b * b + c * c);
  if (Number.isInteger(d)) CUBOIDS.push([a, b, c, d]);
}
/** a ≤ b with √(a² + b²) whole. */
const TRIPLES: Array<[number, number, number]> = [];
for (let a = 3; a <= 24; a++) for (let b = a; b <= 24; b++) {
  const c = Math.sqrt(a * a + b * b);
  if (Number.isInteger(c)) TRIPLES.push([a, b, c]);
}
/** Square-based pyramids (side s, height h) whose slant edge √(h² + s²/2) is whole. */
const PYRAMID_EDGES: Array<[number, number, number]> = [];
for (let s = 2; s <= 24; s += 2) for (let h = 1; h <= 24; h++) {
  const e = Math.sqrt(h * h + (s * s) / 2);
  if (Number.isInteger(e)) PYRAMID_EDGES.push([s, h, e]);
}

const deg1 = (x: number) => `${(Math.round(x * 10) / 10).toFixed(1)}°`;

const space3d = T('space_3d', /^حل مسائل ثلاثيه الابعاد$/, [10, 10], ({ rng, diff }) => {
  const t = tier(diff);
  const k = pick(rng, [0, 1, 2, 3, 4, 5]);
  const cuboid = () => {
    const pool = t === 0 ? CUBOIDS.filter(q => q[3] <= 9) : t === 1 ? CUBOIDS.filter(q => q[3] <= 13) : CUBOIDS;
    const [a, b, c, d] = pick(rng, pool);
    const [x, y, z] = shuffle(rng, [a, b, c]);
    return { x: x!, y: y!, z: z!, d };
  };
  const triple = () => {
    const pool = TRIPLES.filter(q => q[2] <= 10 + 12 * t + (t === 2 ? 8 : 0));
    const [a, b, c] = pick(rng, pool);
    return rng() < 0.5 ? { a, b, c } : { a: b, b: a, c };
  };

  if (k === 0) {
    const { x, y, z, d } = cuboid();
    const answer = String(d);
    return {
      eq: `${x}, ${y}, ${z}`, answer,
      wrongs: wr(answer, [x + y + z, Math.round(Math.sqrt(x * x + y * y)), d + 1, d - 1, x * x + y * y + z * z].map(String), j => String(d + j)),
      ar: `متوازي مستطيلات أبعاده ${x} سم و ${y} سم و ${z} سم. ما طول قطره (من رأس إلى الرأس المقابل له) بالسنتيمتر؟`,
      en: `A cuboid measures ${x} cm by ${y} cm by ${z} cm. What is the length of its space diagonal (from one vertex to the opposite vertex) in centimetres?`,
    };
  }

  if (k === 1) {
    const { x, y, z, d } = cuboid();
    const answer = String(z);
    return {
      eq: `${d}, ${x}, ${y}`, answer,
      wrongs: wr(answer, [d - x - y, Math.abs(d - x), x + y, z + 1, z - 1].filter(v => v > 0).map(String), j => String(z + j)),
      ar: `متوازي مستطيلات بُعدان من أبعاده ${x} سم و ${y} سم، وطول قطره ${d} سم. ما بُعده الثالث بالسنتيمتر؟`,
      en: `Two edges of a cuboid are ${x} cm and ${y} cm, and its space diagonal is ${d} cm. What is the length of its third edge in centimetres?`,
    };
  }

  if (k === 2) {
    // square pyramid: the slant height of a face is √(h² + (s/2)²)
    const { a, b, c } = triple();
    const h = a, half = b, slant = c;
    const answer = String(slant);
    return {
      eq: `${2 * half}, ${h}`, answer,
      wrongs: wr(answer, [h + half, Math.abs(h - half), slant + 1, slant - 1, 2 * half].filter(v => v > 0).map(String), j => String(slant + j)),
      ar: `هرم قائم قاعدته مربعة طول ضلعها ${2 * half} سم وارتفاعه ${h} سم. ما طول الارتفاع الجانبي لأحد وجهيه الجانبيين (من رأس الهرم إلى منتصف ضلع في القاعدة) بالسنتيمتر؟`,
      en: `A right pyramid has a square base of side ${2 * half} cm and a height of ${h} cm. What is the slant height of a face (from the apex to the midpoint of a base edge) in centimetres?`,
    };
  }

  if (k === 3) {
    // the sloping edge from the apex to a corner of the base
    const [s, h, e] = pick(rng, PYRAMID_EDGES.filter(q => q[2] <= 14 + 12 * t));
    const answer = String(e);
    return {
      eq: `${s}, ${h}`, answer,
      wrongs: wr(answer, [h + s, Math.round(Math.sqrt(h * h + s * s)), s, e + 1, e - 1, h].filter(v => v > 0).map(String), j => String(e + j)),
      ar: `هرم قائم قاعدته مربعة طول ضلعها ${s} سم وارتفاعه ${h} سم. ما طول حافته الجانبية (من رأس الهرم إلى أحد رؤوس القاعدة) بالسنتيمتر؟`,
      en: `A right pyramid has a square base of side ${s} cm and a height of ${h} cm. What is the length of a sloping edge (from the apex to a corner of the base) in centimetres?`,
    };
  }

  if (k === 4) {
    // the angle between the space diagonal and the base: tan θ = height / base diagonal
    const { a, b, c: base } = triple();
    const c = pick(rng, t === 0 ? [base, 2 * a, 2 * b] : [base, a + b, 2 * a, b + 3, a + 2]);
    const theta = Math.atan(c / base) / RAD;
    const D = Math.sqrt(base * base + c * c);
    const answer = deg1(theta);
    return {
      eq: `${a}, ${b}, ${c}`, answer,
      wrongs: wr(answer, [deg1(90 - theta), deg1(Math.atan(c / D) / RAD), deg1(Math.atan(c / Math.max(a, b)) / RAD), deg1(Math.atan(c / (a + b)) / RAD), deg1(Math.atan(c / Math.min(a, b)) / RAD)], j => deg1(theta + 5 * Math.abs(j))),
      ar: `متوازي مستطيلات قاعدته ${a} سم × ${b} سم، وارتفاعه ${c} سم. ما قياس الزاوية بين قطره وقاعدته؟ (لأقرب جزء من عشرة من الدرجة)`,
      en: `A cuboid has a base ${a} cm by ${b} cm and a height of ${c} cm. What is the angle between its space diagonal and its base? (to the nearest tenth of a degree)`,
    };
  }

  // a tower seen at 45° from B; C is on the ground with AC perpendicular to AB (A is the foot of the tower)
  const { a, b, c } = triple();
  const h = a, m = b;
  const answer = String(c);
  return {
    eq: `${h}, ${m}`, answer,
    wrongs: wr(answer, [h + m, Math.abs(h - m), c + 1, c - 1, Math.round(Math.sqrt(c * c + h * h))].filter(v => v > 0).map(String), j => String(c + j)),
    ar: `برج رأسي ارتفاعه ${h} م وقاعدته عند النقطة A على أرض أفقية. من النقطة B على الأرض تبلغ زاوية ارتفاع قمة البرج 45°. النقطة C على الأرض بحيث AC = ${m} م وAC عمودي على AB. ما المسافة BC بالمتر؟`,
    en: `A vertical tower ${h} m high stands at point A on level ground. From point B on the ground the angle of elevation of the top of the tower is 45°. Point C is on the ground with AC = ${m} m and AC perpendicular to AB. What is the distance BC in metres?`,
  };
});

// ─── «اقترانات كثيرات الحدود» ─────────────────────────────────────────────────

/** A random polynomial of the given degree: non-zero leading coefficient, any others. */
function randomPoly(rng: Rng, degree: number, span: number, constant = true): number[] {
  const lead = nz(rng, span);
  const rest = Array.from({ length: degree }, (_, i) => (i === degree - 1 && constant ? nz(rng, span) : int(rng, -span, span)));
  return [lead, ...rest];
}

const polyFn = T('poly_fn', /^اقترانات كثيرات الحدود$/, [10, 10], ({ rng, diff }) => {
  const t = tier(diff);
  const k = pick(rng, [0, 1, 2, 3, 4, 5]);
  const span = 3 + 2 * t;

  if (k === 0) {
    // the terms are written out of order: the degree, leading coefficient and constant term are read off
    const n = int(rng, 2, t === 0 ? 3 : 5);
    const coefs = randomPoly(rng, n, span);
    const terms = shuffle(rng, coefs.map((c, i) => [c, n - i] as const));
    const shown = polyTerms(terms);
    const which = pick(rng, ['degree', 'lead', 'constant'] as const);
    if (which === 'degree') {
      return {
        eq: shown, answer: String(n),
        wrongs: wr(String(n), [n + 1, n - 1, coefs.filter(c => c !== 0).length, Math.abs(coefs[0]!), coefs.length + 1].filter(v => v > 0).map(String), j => String(n + Math.abs(j) + 1)),
        ar: `ما درجة كثير الحدود ${shown}؟`, en: `What is the degree of the polynomial ${shown}?`,
      };
    }
    if (which === 'lead') {
      const lead = coefs[0]!;
      return {
        eq: shown, answer: signed(lead),
        wrongs: wr(signed(lead), [signed(-lead), signed(coefs[coefs.length - 1]!), String(n), signed(terms[0]![0]), signed(lead + 1)], j => signed(lead + j)),
        ar: `ما المعامل الرئيس لكثير الحدود ${shown}؟`, en: `What is the leading coefficient of the polynomial ${shown}?`,
      };
    }
    const c0 = coefs[n]!;
    return {
      eq: shown, answer: signed(c0),
      wrongs: wr(signed(c0), [signed(-c0), signed(coefs[0]!), signed(coefs[n - 1]!), String(n), signed(c0 + 1)], j => signed(c0 + j)),
      ar: `ما الحد الثابت في كثير الحدود ${shown}؟`, en: `What is the constant term of the polynomial ${shown}?`,
    };
  }

  if (k === 1) {
    // which of these four is a polynomial?
    const a = int(rng, 2, 7), b = int(rng, 1, 9);
    const good = poly(randomPoly(rng, int(rng, 2, 4), span));
    const bad = shuffle(rng, [`x${sup(-2)} + ${a}`, `√x + ${b}`, `${a}/x + ${b}`, `${a}^x + ${b}`, `|x| + ${b}`, `x${sup(-1)} − ${a}x`]).slice(0, 3);
    const options = shuffle(rng, [good, ...bad]);
    return {
      eq: options.join(' ، '), answer: good,
      wrongs: bad,
      ar: `أيُّ الآتية كثير حدود: ${options.join(' ، ')}؟`,
      en: `Which of these is a polynomial: ${options.join(', ')}?`,
    };
  }

  if (k === 2) {
    // a value of the function
    const n = int(rng, 2, t === 0 ? 2 : 3);
    const coefs = randomPoly(rng, n, 2 + t);
    const x0 = pick(rng, t === 0 ? [1, 2, -1, 0] : [-3, -2, -1, 2, 3, 4]);
    const f = poly(coefs);
    const v = polyAt(coefs, x0);
    return {
      eq: `f(${signed(x0)})`, answer: signed(v),
      wrongs: wr(signed(v), [signed(polyAt(coefs, -x0)), signed(-v), signed(v + coefs[coefs.length - 1]!), signed(v + 1), signed(v - 1)], j => signed(v + j)),
      ar: `إذا كان f(x) = ${f}، فما قيمة f(${signed(x0)})؟`,
      en: `If f(x) = ${f}, what is f(${signed(x0)})?`,
    };
  }

  // sums, differences and products, written in standard form
  const n1 = int(rng, 2, 3), n2 = int(rng, 2, 3);
  const f = randomPoly(rng, n1, span);
  let g = randomPoly(rng, n2, span);
  // never f = ±g: the sum or difference would be the zero polynomial, which has no standard form to ask for
  while (polyAdd(f, g, 1).every(c => c === 0) || polyAdd(f, g, -1).every(c => c === 0)) g = randomPoly(rng, n2, span);
  if (k === 3 || k === 4) {
    const sub = k === 4;
    const right = polyAdd(f, g, sub ? -1 : 1);
    const slip = polyAdd(f, g, sub ? 1 : -1);
    const answer = poly(right);
    // the usual slips: the other operation; the sign of only the first term of g kept when subtracting
    const half = sub ? polyAdd(f, [g[0]!, ...g.slice(1).map(c => -c)], 1) : polyAdd(f, [-g[0]!, ...g.slice(1)], 1);
    const bumped = right.map((c, i) => (i === right.length - 1 ? c + 1 : c));
    const flipped = right.map((c, i) => (i === Math.floor(right.length / 2) ? -c : c));
    return {
      eq: `f(x) ${sub ? '−' : '+'} g(x)`, answer,
      wrongs: wr(answer, [poly(slip), poly(half), poly(bumped), poly(flipped)], j => poly(right.map((c, i) => (i === 0 ? c + j : c)))),
      ar: `إذا كان f(x) = ${poly(f)}، g(x) = ${poly(g)}، فأجد f(x) ${sub ? '−' : '+'} g(x) بالصورة القياسية.`,
      en: `If f(x) = ${poly(f)} and g(x) = ${poly(g)}, find f(x) ${sub ? '−' : '+'} g(x) in standard form.`,
    };
  }
  // k === 5: (x − p)(x² + b·x + c)
  const p = nz(rng, 1 + t * 2 + 2), b = nz(rng, 4), c = nz(rng, 5);
  const right = polyMul([1, -p], [1, b, c]);
  const answer = poly(right);
  const noCross = [1, b - p, c, -p * c]; // forgets p·b·x² cross-check: wrong middle terms
  const signSlip = polyMul([1, p], [1, b, c]);
  const dropped = [1, b - p, c - p * b];
  return {
    eq: `(${linear(p)})(${poly([1, b, c])})`, answer,
    wrongs: wr(answer, [poly(noCross), poly(signSlip), poly(dropped), poly([1, b - p, c + p * b, -p * c])], j => poly([1, b - p + j, c - p * b, -p * c])),
    ar: `أجد ناتج (${linear(p)})(${poly([1, b, c])}) بالصورة القياسية.`,
    en: `Find (${linear(p)})(${poly([1, b, c])}) in standard form.`,
  };
});

// ─── «الاقترانات النسبية» ─────────────────────────────────────────────────────

/** The fraction written the way a line of text can hold it. */
const frac = (num: string, den: string) => `(${num})/(${den})`;

const rationalFn = T('rational_fn', /^(?:قسمه كثيرات الحدود و)?الاقترانات النسبيه$/, [10, 10], ({ rng, diff }) => {
  const t = tier(diff);
  const k = pick(rng, [0, 1, 2, 3, 4, 5, 6]);
  const span = 2 + t;

  if (k === 0 || k === 1) {
    // dividing a cubic by (x − r): the remainder (k = 0), or the quotient when the division is exact (k = 1)
    const r = nz(rng, 2 + t);
    const exact = k === 1;
    let coefs: number[];
    if (exact) coefs = polyMul([1, -r], [nz(rng, 2), nz(rng, 4), nz(rng, 6)]);
    else coefs = randomPoly(rng, 3, span + 1);
    const { quotient, remainder } = divideByLinear(coefs, r);
    const f = poly(coefs), d = linear(r);
    if (exact) {
      const answer = poly(quotient);
      return {
        eq: `${f} ÷ (${d})`, answer,
        wrongs: wr(answer, [poly(divideByLinear(coefs, -r).quotient), poly(quotient.map((c, i) => (i === quotient.length - 1 ? -c : c))), poly(quotient.map((c, i) => (i === 1 ? c + 1 : c))), poly(quotient.map(c => -c))], j => poly(quotient.map((c, i) => (i === 0 ? c + j : c)))),
        ar: `أجد ناتج قسمة ${f} على ${d} (القسمة تامة: الباقي 0).`,
        en: `Find the quotient of ${f} divided by ${d} (the division is exact: the remainder is 0).`,
      };
    }
    const answer = signed(remainder);
    return {
      eq: `${f} ÷ (${d})`, answer,
      wrongs: wr(answer, [signed(polyAt(coefs, -r)), signed(-remainder), signed(remainder + r), signed(coefs[coefs.length - 1]!), signed(remainder + 1)], j => signed(remainder + j)),
      ar: `أجد باقي قسمة ${f} على ${d}.`,
      en: `Find the remainder when ${f} is divided by ${d}.`,
    };
  }

  if (k === 2) {
    // the domain: every real number except the zeros of the denominator
    const a = nz(rng, 3 + t);
    let b = nz(rng, 3 + t);
    const form = pick(rng, [0, 1, 2]);
    if (form === 0) b = -a; // x² − a²
    while (form !== 0 && b === a) b = nz(rng, 3 + t);
    const den = form === 2 ? polyMul([1, 0], [1, -a]) : polyMul([1, -a], [1, -b]);
    const zeros = form === 2 ? [0, a] : [a, b];
    const n = int(rng, -4, 6);
    // a list of excluded values, once each and ascending, so two lists are the same answer exactly when their text is
    const excluded = (zs: number[]) => [...new Set(zs)].sort((u, v) => u - v).map(z => `x ≠ ${signed(z)}`).join(' ، ');
    const answer = excluded(zeros);
    const num = poly([1, n]);
    const [z1, z2] = [...new Set(zeros)].sort((u, v) => u - v) as [number, number];
    return {
      eq: `${frac(num, poly(den))}`, answer,
      // the numerator's zero is not excluded from a domain, and a lone zero of the denominator is only half the answer
      wrongs: wr(answer, [excluded([z1]), excluded([z2]), excluded([-z1, -z2]), excluded([-n]), excluded([...zeros, -n])], j => excluded([z1 + j, z2])),
      ar: `ما مجال الاقتران النسبي f(x) = ${frac(num, poly(den))}؟`,
      en: `What is the domain of the rational function f(x) = ${frac(num, poly(den))}?`,
    };
  }

  if (k === 3 || k === 6) {
    // f(x) = a/(x − b) + c: the asymptotes (k = 3), or the range (k = 6)
    const a = nz(rng, 4 + t);
    const b = nz(rng, 4 + t);
    // y = ±b would be a real asymptote of its own if c were ±b, which would make a wrong option right
    let c = nz(rng, 5);
    while (Math.abs(c) === Math.abs(b)) c = nz(rng, 5);
    const f = `${a < 0 ? '−' : ''}${Math.abs(a)}/(${linear(b)}) ${c < 0 ? '−' : '+'} ${Math.abs(c)}`;
    if (k === 6) {
      const answer = `y ≠ ${signed(c)}`;
      return {
        eq: f, answer,
        wrongs: wr(answer, [`y ≠ ${signed(b)}`, `y ≠ ${signed(-c)}`, 'y ≠ 0', `y ≠ ${signed(a)}`], j => `y ≠ ${signed(c + j)}`),
        ar: `ما مدى الاقتران f(x) = ${f}؟`,
        en: `What is the range of f(x) = ${f}?`,
      };
    }
    const vertical = rng() < 0.5;
    const answer = vertical ? `x = ${signed(b)}` : `y = ${signed(c)}`;
    const wrongs = vertical
      ? [`x = ${signed(-b)}`, `y = ${signed(b)}`, `x = ${signed(c)}`, `y = ${signed(-b)}`]
      : [`y = ${signed(-c)}`, `x = ${signed(c)}`, `y = ${signed(b)}`, `x = ${signed(-c)}`];
    return {
      eq: f, answer,
      wrongs: wr(answer, wrongs, j => `${vertical ? 'x' : 'y'} = ${signed((vertical ? b : c) + j)}`),
      ar: `ما معادلة خط التقارب ${vertical ? 'الرأسي' : 'الأفقي'} لمنحنى الاقتران f(x) = ${f}؟`,
      en: `What is the equation of the ${vertical ? 'vertical' : 'horizontal'} asymptote of the graph of f(x) = ${f}?`,
    };
  }

  if (k === 4) {
    // (m·x + n)/(x + q): divide first — it is m − (m·q − n)/(x + q), so the asymptotes are x = −q and y = m
    const m = int(rng, 2, 7);
    const q = nz(rng, 5);
    let n = nz(rng, 9);
    while (n === m * q) n = nz(rng, 9);
    const f = frac(poly([m, n]), poly([1, q]));
    const vertical = rng() < 0.5;
    const answer = vertical ? `x = ${signed(-q)}` : `y = ${signed(m)}`;
    const wrongs = vertical
      ? [`x = ${signed(q)}`, `y = ${signed(-q)}`, `x = ${signed(-n)}`, `y = ${signed(m)}`]
      : [`y = ${signed(-m)}`, `x = ${signed(m)}`, `y = ${signed(n)}`, `y = ${signed(q)}`];
    return {
      eq: f, answer,
      wrongs: wr(answer, wrongs, j => `${vertical ? 'x' : 'y'} = ${signed((vertical ? -q : m) + j)}`),
      ar: `ما معادلة خط التقارب ${vertical ? 'الرأسي' : 'الأفقي'} لمنحنى الاقتران f(x) = ${f}؟`,
      en: `What is the equation of the ${vertical ? 'vertical' : 'horizontal'} asymptote of the graph of f(x) = ${f}?`,
    };
  }

  // k === 5: a rational expression whose numerator factors with the denominator
  const a = nz(rng, 4 + t);
  const b = nz(rng, 4 + t);
  const num = polyMul([1, a], [1, b]);
  const answer = poly([1, b]);
  return {
    eq: frac(poly(num), poly([1, a])), answer,
    wrongs: wr(answer, [poly([1, a]), poly([1, -b]), poly([1, a + b]), poly([1, a * b])], j => poly([1, b + j])),
    ar: `أبسِّط المقدار الجبري النسبي ${frac(poly(num), poly([1, a]))} (x ≠ ${signed(-a)}).`,
    en: `Simplify the rational algebraic expression ${frac(poly(num), poly([1, a]))} (x ≠ ${signed(-a)}).`,
  };
});

/** The generators of this file, in `topics.ts`'s table order. */
export const G10_TOPICS: readonly Topic[] = [specialEq, trigGraph, space3d, polyFn, rationalFn];
