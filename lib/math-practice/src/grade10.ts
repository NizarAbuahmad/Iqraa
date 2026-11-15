/**
 * Grade 10 lessons the bank was thin on, or had nothing for (audit,
 * 2026-11-13). «قانون الجيوب» and «قانون جيب التمام» shared the `trig_apps`
 * family — three items in all — the three trigonometry lessons shared `trig`'s
 * six, «معادلة الدائرة» got `circle`, half of it arc length and area, and four
 * lessons got nothing: graphing the trigonometric functions, 3-D problems,
 * polynomial functions, polynomial division and rational functions.
 *
 * One generator per lesson, each asking what its pages of the NCCD student
 * book ask in their examples and «أتحقق من فهمي» (S1 pp. 54-61, 66-95,
 * 106-118, 124-129; S2 pp. 8-24). Same contract as `topics.ts`: the lesson
 * title picks the generator, and every answer is computed from the numbers in
 * its own stem. Angles are the special ones (30°, 45°, 60° and their relatives
 * in the full turn), triangles and solids are chosen so a length comes out
 * whole or as a simple surd («8√2»), polynomials have whole coefficients.
 *
 * `G10_LESSON_FIRST` names these generators; for exactly those lessons
 * `takeConcreteMath` serves the generator instead of the shared family pool.
 * Nothing here is `verified`: a generated key is computed, never checked by
 * the verifier.
 */
import { int, nz, pick, sfrac, signed, sup, wrongsFrom, type Draft, type Rng, type Topic } from './topicKit.ts';
import { G10B_TOPICS } from './grade10b.ts';

type D = 'easy' | 'medium' | 'hard';
type Gen = (c: { rng: Rng; diff: D; grade: number }) => Draft;
const T = (id: string, match: RegExp, make: Gen): Topic => ({ id, match, grades: [10, 10], make });

const shuffle = <X,>(rng: Rng, xs: readonly X[]) => {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = int(rng, 0, i); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
};
const dg = (n: number) => `${signed(n)}°`;
/** Whole-number options above zero. */
const pos = (ans: number, cands: number[]) =>
  wrongsFrom(String(ans), cands.filter(c => Number.isInteger(c) && c > 0).map(String), k => String(ans + Math.abs(k)));
/** Signed whole-number options. */
const sgn = (ans: number, cands: number[]) =>
  wrongsFrom(signed(ans), cands.filter(Number.isInteger).map(signed), k => signed(ans + k));
/** Angle options strictly between `lo` and `hi`. */
const degOpts = (ans: number, cands: number[], lo = 0, hi = 360, step = 5) =>
  wrongsFrom(dg(ans), cands.filter(c => Number.isInteger(c) && c > lo && c < hi).map(dg), k => (ans + step * Math.abs(k) < hi ? dg(ans + step * Math.abs(k)) : ''));
/** «(−3 ، 4)»; coordinates may be fractions over `d`. */
const pt = (x: number, y: number, d = 1) => `(${sfrac(x, d)} ، ${sfrac(y, d)})`;

/** √n in simplest form: «7», «2√7», «√37». */
function root(n: number): string {
  let out = 1, r = n;
  for (let k = 2; k * k <= r; k++) while (r % (k * k) === 0) { out *= k; r /= k * k; }
  return r === 1 ? String(out) : out === 1 ? `√${r}` : `${out}√${r}`;
}
/** A positive length as «c√r» (r = 1, 2, 3 or 6, c whole), or null when it is not one. */
function asSurd(v: number): { c: number; r: number; s: string } | null {
  for (const r of [1, 2, 3, 6]) {
    const c = v / Math.sqrt(r);
    const w = Math.round(c);
    if (w > 0 && Math.abs(c - w) < 1e-9) return { c: w, r, s: r === 1 ? String(w) : w === 1 ? `√${r}` : `${w}√${r}` };
  }
  return null;
}
const surdNear = (c: number, r: number) => (k: number) => (r === 1 ? String(c + Math.abs(k)) : `${c + Math.abs(k)}√${r}`);

// ─── exact values of the special angles ─────────────────────────────────────

const rad = (d: number) => (d * Math.PI) / 180;
const SIN0: Record<number, string> = { 0: '0', 30: '1/2', 45: '√2/2', 60: '√3/2', 90: '1' };
const COS0: Record<number, string> = { 0: '1', 30: '√3/2', 45: '√2/2', 60: '1/2', 90: '0' };
const TAN0: Record<number, string> = { 0: '0', 30: '1/√3', 45: '1', 60: '√3' };
const UNDEF = 'غير معرّف';
const neg = (s: string) => (s === '0' || s === UNDEF ? s : s.startsWith('−') ? s.slice(1) : `−${s}`);
/** The exact value the book's table gives, by reference angle and the sign of the quadrant. */
function exact(fn: 'sin' | 'cos' | 'tan', d: number): string {
  const ref = d <= 90 ? d : d <= 180 ? 180 - d : d <= 270 ? d - 180 : 360 - d;
  if (fn === 'tan' && ref === 90) return UNDEF;
  const v = (fn === 'sin' ? SIN0 : fn === 'cos' ? COS0 : TAN0)[ref]!;
  const positive = fn === 'sin' ? d > 0 && d < 180 : fn === 'cos' ? d < 90 || d > 270 : (d > 0 && d < 90) || (d > 180 && d < 270);
  return positive ? v : neg(v);
}
const ALL_EXACT = ['0', '1/2', '√2/2', '√3/2', '1', '1/√3', '√3', '−1/2', '−√2/2', '−√3/2', '−1', '−1/√3', '−√3'];

/**
 * The solutions of fn x = v for 0° ≤ x < 360°, the book's way: the reference
 * angle from the inverse ratio, then the quadrants where the ratio has v's sign.
 */
function solve(fn: 'sin' | 'cos' | 'tan', v: number): number[] {
  const deg = (r: number) => Math.round((r * 180) / Math.PI);
  let out: number[];
  if (fn === 'tan') {
    const a = deg(Math.atan(Math.abs(v)));
    out = v >= 0 ? [a, a + 180] : [180 - a, 360 - a];
  } else if (Math.abs(Math.abs(v) - 1) < 1e-12) {
    out = fn === 'sin' ? [v > 0 ? 90 : 270] : [v > 0 ? 0 : 180];
  } else if (Math.abs(v) < 1e-12) {
    out = fn === 'sin' ? [0, 180] : [90, 270];
  } else {
    const a = deg(fn === 'sin' ? Math.asin(Math.abs(v)) : Math.acos(Math.abs(v)));
    out = fn === 'sin' ? (v > 0 ? [a, 180 - a] : [180 + a, 360 - a]) : v > 0 ? [a, 360 - a] : [180 - a, 180 + a];
  }
  return [...new Set(out.map(x => x % 360))].sort((x, y) => x - y);
}
const degs = (xs: number[]) => [...new Set(xs)].sort((x, y) => x - y).map(x => `${x}°`).join(' ، ');
const fnName = (fn: string) => (fn === 'sin' ? 'الجيب' : fn === 'cos' ? 'جيب التمام' : 'الظل');
const fnEn = (fn: string) => (fn === 'sin' ? 'sine' : fn === 'cos' ? 'cosine' : 'tangent');
const FNS = ['sin', 'cos', 'tan'] as const;

// ─── polynomials ────────────────────────────────────────────────────────────

/** Terms in the order given: [coefficient, exponent]; zero terms are left out. */
function terms(list: Array<[number, number]>, v = 'x'): string {
  let out = '';
  for (const [c, e] of list) {
    if (c === 0) continue;
    const a = Math.abs(c);
    const body = e === 0 ? String(a) : `${a === 1 ? '' : a}${v}${e === 1 ? '' : sup(e)}`;
    out += out === '' ? (c < 0 ? `−${body}` : body) : c < 0 ? ` − ${body}` : ` + ${body}`;
  }
  return out === '' ? '0' : out;
}
/** Coefficients from the highest power down: [2, 0, 24, −15] is 2x³ + 24x − 15. */
const desc = (cs: number[], v = 'x') => terms(cs.map((c, i) => [c, cs.length - 1 - i] as [number, number]), v);
const evalDesc = (cs: number[], x: number) => cs.reduce((s, c) => s * x + c, 0);
/** Synthetic division by (x − r): [quotient, remainder]. */
function synth(cs: number[], r: number): [number[], number] {
  const q: number[] = [];
  let carry = 0;
  for (const c of cs) { carry = carry * r + c; q.push(carry); }
  const rem = q.pop()!;
  return [q, rem];
}
/** «x − 3» / «x + 2» for the root r. */
const lin = (r: number, v = 'x') => `${v} ${r >= 0 ? '−' : '+'} ${Math.abs(r)}`;

// ─── «معادلة الدائرة» (S1 pp. 54-61) ─────────────────────────────────────────

const sq = (v: 'x' | 'y', a: number) => (a === 0 ? `${v}²` : `(${lin(a, v)})²`);
const stdEq = (a: number, b: number, r2: number) => `${sq('x', a)} + ${sq('y', b)} = ${r2}`;
const TRIPLES: Array<[number, number, number]> = [[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17], [9, 12, 15], [7, 24, 25], [12, 16, 20]];
/** [dx, dy, r, tangent]: a point (dx, dy) from the centre, outside a circle of radius r, with a whole tangent length. */
const TANGENTS: Array<[number, number, number, number]> = [];
for (let dx = 1; dx <= 12; dx++) {
  for (let dy = 1; dy <= 12; dy++) {
    for (let r = 2; r <= 12; r++) {
      const t2 = dx * dx + dy * dy - r * r, t = Math.round(Math.sqrt(Math.max(t2, 0)));
      if (t2 > 0 && t * t === t2) TANGENTS.push([dx, dy, r, t]);
    }
  }
}
const NON_SQUARE = [8, 12, 18, 20, 24, 27, 28, 32, 45, 48, 50, 75];

/**
 * The lesson's examples: the equation from a centre and radius (or a centre and
 * a point on the circle), the centre and radius read from the standard form and
 * from the general form by completing the square, and the length of a tangent
 * from an outside point.
 */
const circleEquation = T('g10_circle_equation', /^معادله الدائره$/, ({ rng, diff }) => {
  const k = pick(rng, [0, 1, 2, 3, 4, 5]);
  const a = nz(rng, 9), b = nz(rng, 9);
  if (k === 0) {
    const r2 = diff === 'hard' && rng() < 0.6 ? pick(rng, NON_SQUARE) : int(rng, 2, 12) ** 2;
    const eq = stdEq(a, b, r2), ans = root(r2);
    const s = /√(\d+)$/.exec(ans);
    return {
      eq, answer: ans,
      wrongs: wrongsFrom(ans, [String(r2), r2 % 2 === 0 ? String(r2 / 2) : '', root(2 * r2)], j => (s ? root(r2 + Math.abs(j)) : String(Math.sqrt(r2) + Math.abs(j)))),
      ar: `ما طول نصف قطر الدائرة التي معادلتها ${eq}؟`,
      en: `What is the radius of the circle ${eq}?`,
    };
  }
  if (k === 1) {
    const r = int(rng, 2, 12), eq = stdEq(a, b, r * r);
    return {
      eq, answer: pt(a, b),
      wrongs: wrongsFrom(pt(a, b), [pt(-a, -b), pt(a, -b), pt(-a, b), pt(b, a)], j => pt(a + Math.abs(j), b)),
      ar: `ما إحداثيا مركز الدائرة التي معادلتها ${eq}؟`,
      en: `What are the coordinates of the centre of the circle ${eq}?`,
    };
  }
  if (k === 2) {
    const [p, q, r] = pick(rng, TRIPLES);
    const [dx, dy] = rng() < 0.5 ? [p, q] : [q, p];
    const px = a + (rng() < 0.5 ? dx : -dx), py = b + (rng() < 0.5 ? dy : -dy);
    return {
      eq: `${pt(a, b)} ${pt(px, py)}`, answer: String(r),
      wrongs: pos(r, [r * r, p + q, Math.abs(px) + Math.abs(py), r + 1]),
      ar: `ما طول نصف قطر الدائرة التي مركزها ${pt(a, b)} وتمر بالنقطة ${pt(px, py)}؟`,
      en: `What is the radius of the circle with centre ${pt(a, b)} that passes through ${pt(px, py)}?`,
    };
  }
  if (k === 3) {
    const r = int(rng, 2, 12), ans = stdEq(a, b, r * r);
    return {
      eq: `${pt(a, b)} r=${r}`, answer: ans,
      wrongs: wrongsFrom(ans, [stdEq(-a, -b, r * r), stdEq(a, b, r), stdEq(-a, -b, r), stdEq(b, a, r * r)], j => stdEq(a, b, r * r + Math.abs(j))),
      ar: `ما معادلة الدائرة التي مركزها ${pt(a, b)} وطول نصف قطرها ${r}؟`,
      en: `What is the equation of the circle with centre ${pt(a, b)} and radius ${r}?`,
    };
  }
  if (k === 4) {
    // x² + y² − 2ax − 2by + (a² + b² − r²) = 0, completed back to the square
    let r = int(rng, 2, 12);
    while (a * a + b * b === r * r) r += 1;
    const F = a * a + b * b - r * r;
    const g = `x² + y² ${a > 0 ? '−' : '+'} ${2 * Math.abs(a)}x ${b > 0 ? '−' : '+'} ${2 * Math.abs(b)}y ${F < 0 ? '−' : '+'} ${Math.abs(F)} = 0`;
    if (rng() < 0.5) {
      return {
        eq: g, answer: String(r),
        wrongs: pos(r, [r * r, Math.abs(F), Math.abs(a) + Math.abs(b), r + 1]),
        ar: `بعد كتابة معادلة الدائرة ${g} بالصورة القياسية، ما طول نصف قطرها؟`,
        en: `Write the circle ${g} in standard form. What is its radius?`,
      };
    }
    return {
      eq: g, answer: pt(a, b),
      wrongs: wrongsFrom(pt(a, b), [pt(-a, -b), pt(-2 * a, -2 * b), pt(2 * a, 2 * b), pt(b, a)], j => pt(a + Math.abs(j), b)),
      ar: `بعد كتابة معادلة الدائرة ${g} بالصورة القياسية، ما إحداثيا مركزها؟`,
      en: `Write the circle ${g} in standard form. What are the coordinates of its centre?`,
    };
  }
  // the tangent from P: XP² − r² by Pythagoras, the radius meeting the tangent at a right angle
  const [dx, dy, r, t] = pick(rng, TANGENTS);
  const px = a + (rng() < 0.5 ? dx : -dx), py = b + (rng() < 0.5 ? dy : -dy);
  const eq = stdEq(a, b, r * r);
  return {
    eq: `${pt(px, py)} ${eq}`, answer: String(t),
    wrongs: pos(t, [t * t, dx * dx + dy * dy - r, r, t + 1]),
    ar: `ما طول القطعة المماسية المرسومة من النقطة P${pt(px, py)} إلى الدائرة التي معادلتها ${eq}؟`,
    en: `What is the length of the tangent segment drawn from P${pt(px, py)} to the circle ${eq}?`,
  };
});

// ─── «النسب المثلثية» (S1 pp. 66-73) ─────────────────────────────────────────

const UNIT_TRIPLES: Array<[number, number, number]> = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]];
const notRight = (rng: Rng, lo: number, hi: number) => { for (;;) { const d = 5 * int(rng, lo / 5, hi / 5); if (d % 90 !== 0) return d; } };

/**
 * Angles in standard position and the unit circle: the angle between 0° and
 * 360° with the same terminal side, the three ratios from the point where the
 * terminal side meets the unit circle, the ratios of the quadrantal angles, and
 * the other ratios from one of them by sin² θ + cos² θ = 1.
 */
const trigRatios = T('g10_trig_ratios', /^النسب المثلثيه$/, ({ rng, diff }) => {
  const k = pick(rng, [0, 1, 2, 3]);
  if (k === 0) {
    const ans = notRight(rng, 10, 350);
    const t = diff === 'hard' && rng() < 0.5 ? ans - 360 : ans + 360 * (diff === 'hard' ? pick(rng, [1, 2]) : 1);
    return {
      eq: dg(t), answer: dg(ans),
      wrongs: degOpts(ans, [(ans + 180) % 360, 360 - ans, Math.abs(t) % 360 === ans ? 0 : Math.abs(t) % 360, (ans + 90) % 360]),
      ar: `ما قياس الزاوية الواقعة بين 0° و 360° التي لها ضلع الانتهاء نفسه للزاوية ${dg(t)} المرسومة في الوضع القياسي؟`,
      en: `Which angle between 0° and 360° has the same terminal side as a ${dg(t)} angle in standard position?`,
    };
  }
  if (k === 1) {
    const [p, q, c] = pick(rng, UNIT_TRIPLES);
    const [x0, y0] = rng() < 0.5 ? [p, q] : [q, p];
    const x = rng() < 0.5 ? -x0 : x0, y = rng() < 0.5 ? -y0 : y0;
    const fn = pick(rng, FNS);
    const ans = fn === 'sin' ? sfrac(y, c) : fn === 'cos' ? sfrac(x, c) : sfrac(y, x);
    const cands = fn === 'sin' ? [sfrac(x, c), sfrac(-y, c), sfrac(y, x)] : fn === 'cos' ? [sfrac(y, c), sfrac(-x, c), sfrac(x, y)] : [sfrac(x, y), sfrac(-y, x), sfrac(y, c)];
    return {
      eq: `${pt(x, y, c)} ${fn}`, answer: ans,
      wrongs: wrongsFrom(ans, [...cands, sfrac(-x, y), sfrac(x, c), sfrac(-y, c)], j => sfrac(y + Math.abs(j), c)),
      ar: `يقطع ضلع انتهاء الزاوية θ المرسومة في الوضع القياسي دائرة الوحدة في النقطة P${pt(x, y, c)}. ما قيمة ${fn} θ؟`,
      en: `The terminal side of an angle θ in standard position meets the unit circle at P${pt(x, y, c)}. What is ${fn} θ?`,
    };
  }
  if (k === 2) {
    const d = pick(rng, [0, 90, 180, 270, 360]), fn = pick(rng, FNS);
    const ans = exact(fn, d);
    return {
      eq: `${fn} ${d}°`, answer: ans,
      wrongs: ['0', '1', '−1', UNDEF].filter(x => x !== ans),
      ar: `ما قيمة ${fn} ${d}°؟`,
      en: `What is ${fn} ${d}°?`,
    };
  }
  // sin θ given, θ's quadrant given: cos θ = ±√(1 − sin² θ), the sign from the quadrant
  const [p, q, c] = pick(rng, UNIT_TRIPLES);
  const quad = int(rng, 1, 4), lo = 90 * (quad - 1);
  const sS = quad <= 2 ? 1 : -1, cS = quad === 1 || quad === 4 ? 1 : -1;
  const given = pick(rng, ['sin', 'cos'] as const);
  const [sN, cN] = given === 'sin' ? [sS * p, cS * q] : [sS * q, cS * p];
  const asked = pick(rng, given === 'sin' ? (['cos', 'tan'] as const) : (['sin', 'tan'] as const));
  const ans = asked === 'sin' ? sfrac(sN, c) : asked === 'cos' ? sfrac(cN, c) : sfrac(sN, cN);
  const given$ = given === 'sin' ? sfrac(sN, c) : sfrac(cN, c);
  return {
    eq: `${given} ${given$} q${quad} ${asked}`, answer: ans,
    wrongs: wrongsFrom(ans, [neg(ans), asked === 'tan' ? sfrac(cN, sN) : sfrac(sN, cN), given$, asked === 'tan' ? sfrac(-sN, cN) : neg(given$), sfrac(cN, sN)], j => sfrac(sN + Math.abs(j), c)),
    ar: `إذا كان ${given} θ = ${given$}، حيث ${lo}° < θ < ${lo + 90}°، فما قيمة ${asked} θ؟`,
    en: `If ${given} θ = ${given$} and ${lo}° < θ < ${lo + 90}°, what is ${asked} θ?`,
  };
});

// ─── «النسب المثلثية للزوايا ضمن الدورة الواحدة» (S1 pp. 74-81) ───────────────

const FULL_TURN = [120, 135, 150, 210, 225, 240, 300, 315, 330];
/** The other angle in 0°–360° with the same ratio. */
const partner = (fn: 'sin' | 'cos' | 'tan', t: number) => (fn === 'sin' ? (540 - t) % 360 : fn === 'cos' ? 360 - t : t < 180 ? t + 180 : t - 180);
const COS_OF: Record<number, number> = { 60: 0.5, 90: 0, 120: -0.5, 180: -1, 240: -0.5, 270: 0, 300: 0.5 };
const SIN_OF: Record<number, number> = { 90: 1, 180: 0, 270: -1 };

/**
 * The reference angle, the exact ratios of the special angles all the way
 * round, a second angle with the same sine, cosine or tangent, and the book's
 * water-wheel model h = a − a cos θ.
 */
const trigFullTurn = T('g10_trig_full_turn', /^النسب المثلثيه للزوايا ضمن الدوره الواحده$/, ({ rng }) => {
  const k = pick(rng, [0, 1, 2, 3]);
  if (k === 0) {
    const t = notRight(rng, 95, 355);
    const ans = t < 180 ? 180 - t : t < 270 ? t - 180 : 360 - t;
    return {
      eq: `ref ${t}`, answer: dg(ans),
      wrongs: degOpts(ans, [Math.abs(180 - t), 360 - t, t - 90, t - 180, t - 270, 90 - ans], 0, 360),
      ar: `ما قياس الزاوية المرجعية للزاوية ${t}°؟`,
      en: `What is the reference angle of ${t}°?`,
    };
  }
  if (k === 1) {
    const t = pick(rng, FULL_TURN), fn = pick(rng, FNS);
    const ans = exact(fn, t);
    const ref = t < 180 ? 180 - t : t < 270 ? t - 180 : 360 - t;
    const other = fn === 'sin' ? exact('cos', t) : fn === 'cos' ? exact('sin', t) : exact('tan', 90 - ref);
    return {
      eq: `${fn} ${t}°`, answer: ans,
      wrongs: wrongsFrom(ans, [neg(ans), other, neg(other), exact(fn, ref), ...ALL_EXACT]),
      ar: `ما القيمة الدقيقة لـ ${fn} ${t}°؟`,
      en: `What is the exact value of ${fn} ${t}°?`,
    };
  }
  if (k === 2) {
    const t = notRight(rng, 5, 355), fn = pick(rng, FNS);
    const ans = partner(fn, t);
    return {
      eq: `${fn} ${t}`, answer: dg(ans),
      wrongs: degOpts(ans, [...FNS.filter(f => f !== fn).map(f => partner(f, t)), 180 - t, t + 90, 360 - t].filter(x => x !== t)),
      ar: `ما الزاوية الثانية بين 0° و 360° التي لها نسبة ${fnName(fn)} نفسها مثل الزاوية ${t}°؟`,
      en: `Which other angle between 0° and 360° has the same ${fnEn(fn)} as ${t}°?`,
    };
  }
  const a = pick(rng, [6, 8, 10, 12, 14, 16, 20]), t = pick(rng, [60, 90, 120, 180, 240, 270, 300]);
  const h = a - a * COS_OF[t]!;
  return {
    eq: `h ${a} ${t}`, answer: String(h),
    // cos θ's sign slipped, sin read for cos, and the heights at the neighbouring special angles
    wrongs: wrongsFrom(String(h), [a + a * COS_OF[t]!, t in SIN_OF ? a - a * SIN_OF[t]! : NaN, a, 2 * a, a / 2, (3 * a) / 2].filter(x => Number.isInteger(x) && x >= 0).map(String), j => String(h + Math.abs(j))),
    ar: `يُعطى ارتفاع راكب في دولاب دوّار عن سطح الأرض بالأمتار بالعلاقة h = ${a} − ${a} cos θ. ما ارتفاع الراكب عندما θ = ${t}°؟`,
    en: `A rider's height above the ground on a big wheel, in metres, is h = ${a} − ${a} cos θ. How high is the rider when θ = ${t}°?`,
  };
});

// ─── «تمثيل الاقترانات المثلثية» (S1 pp. 82-87) ───────────────────────────────

const HALF_ANGLES: Record<'sin' | 'cos', number[]> = { sin: [0, 30, 90, 150, 180, 210, 270, 330], cos: [0, 60, 90, 120, 180, 240, 270, 300] };
/** sin and cos of the angles above, exactly. */
const halfValue = (fn: 'sin' | 'cos', d: number) => {
  const s = exact(fn, d);
  return s === '0' ? 0 : s === '1' ? 1 : s === '−1' ? -1 : s === '1/2' ? 0.5 : -0.5;
};
const num1 = (n: number) => signed(n);

/**
 * Reading the graphs of sine, cosine and tangent over a full turn: the other
 * angle with the same value (the curve's symmetry), where a horizontal line cuts
 * the curve, the greatest and least values of y = a sin x and where they fall,
 * and the value at a point.
 */
const trigGraphs = T('g10_trig_graphs', /^تمثيل الاقترانات المثلثيه$/, ({ rng, diff }) => {
  const k = pick(rng, [0, 1, 2, 3, 4]);
  if (k === 0) {
    const fn = pick(rng, FNS), t = notRight(rng, 5, 355), c = partner(fn, t);
    return {
      eq: `${fn} ${t} = ${fn} c`, answer: dg(c),
      wrongs: degOpts(c, [...FNS.filter(f => f !== fn).map(f => partner(f, t)), 360 - t, t + 180, 180 - t].filter(x => x !== t), -1, 361),
      ar: `من منحنى الاقتران y = ${fn} x: إذا كان ${fn} ${t}° = ${fn} c°، حيث 0° ≤ c ≤ 360° و c ≠ ${t}°، فما قيمة c؟`,
      en: `From the graph of y = ${fn} x: if ${fn} ${t}° = ${fn} c°, where 0° ≤ c ≤ 360° and c ≠ ${t}°, what is c?`,
    };
  }
  if (k === 1) {
    const fn = pick(rng, FNS), v = fn === 'tan' ? pick(rng, [1, -1]) : pick(rng, [0.5, -0.5]);
    const sols = solve(fn, v), other = fn === 'sin' ? 'cos' : fn === 'cos' ? 'sin' : 'sin';
    const ans = degs(sols);
    return {
      eq: `${fn} = ${num1(v)}`, answer: ans,
      wrongs: wrongsFrom(ans, [degs(solve(fn, -v)), degs(solve(other, fn === 'tan' ? v / 2 : v)), degs([sols[0]!]), degs(sols.map(x => (x + 90) % 360))]),
      ar: `يقطع المستقيم y = ${num1(v)} منحنى الاقتران y = ${fn} x في الفترة 0° ≤ x ≤ 360°. ما قيم x عند نقاط التقاطع؟`,
      en: `The line y = ${num1(v)} cuts the graph of y = ${fn} x for 0° ≤ x ≤ 360°. At what values of x?`,
    };
  }
  const fn = pick(rng, ['sin', 'cos'] as const);
  const a = (diff === 'hard' && rng() < 0.5 ? -1 : 1) * int(rng, 2, 6);
  const f = `y = ${signed(a)} ${fn} x`;
  if (k === 2) {
    const most = rng() < 0.5, ans = most ? Math.abs(a) : -Math.abs(a);
    return {
      eq: f, answer: signed(ans),
      wrongs: sgn(ans, most ? [-Math.abs(a), 1, 2 * Math.abs(a), a] : [Math.abs(a), -1, -2 * Math.abs(a), a]),
      ar: `ما القيمة ${most ? 'العظمى' : 'الصغرى'} للاقتران ${f}؟`,
      en: `What is the ${most ? 'greatest' : 'least'} value of ${f}?`,
    };
  }
  if (k === 3) {
    // where fn x is +1 or −1, by the sign of a
    const most = rng() < 0.5, top = (a > 0) === most;
    const ans = fn === 'sin' ? (top ? 90 : 270) : top ? 0 : 180;
    return {
      eq: `${f} ${most ? 'max' : 'min'}`, answer: dg(ans),
      wrongs: [0, 90, 180, 270].filter(x => x !== ans).map(dg),
      ar: `عند أي قيمة لـ x في الفترة 0° ≤ x < 360° يبلغ الاقتران ${f} قيمته ${most ? 'العظمى' : 'الصغرى'}؟`,
      en: `At what value of x, 0° ≤ x < 360°, does ${f} reach its ${most ? 'greatest' : 'least'} value?`,
    };
  }
  const x = pick(rng, HALF_ANGLES[fn]);
  const ans = a * halfValue(fn, x);
  const otherAt = HALF_ANGLES[fn === 'sin' ? 'cos' : 'sin'].includes(x) ? a * halfValue(fn === 'sin' ? 'cos' : 'sin', x) : NaN;
  return {
    eq: `${f} ${x}`, answer: num1(ans),
    wrongs: wrongsFrom(num1(ans), [otherAt, -ans, a, 2 * ans, ans + a].filter(Number.isFinite).map(num1), j => num1(ans + Math.abs(j))),
    ar: `ما قيمة الاقتران ${f} عندما x = ${x}°؟`,
    en: `What is the value of ${f} when x = ${x}°?`,
  };
});

// ─── «حل المعادلات المثلثية» (S1 pp. 88-95) ───────────────────────────────────

const INTERVAL = 'في الفترة 0° ≤ x < 360°';
const R2 = Math.SQRT2 / 2, R3 = Math.sqrt(3) / 2;
/** «+ 3» / «− 3» after a term. */
const tail = (n: number | string) => (typeof n === 'string' ? (n.startsWith('−') ? `− ${n.slice(1)}` : `+ ${n}`) : n < 0 ? `− ${-n}` : `+ ${n}`);
/** Wrong solution sets that are real slips, then near ones, never the answer's own set. */
function setOpts(ans: string, slips: number[][], sols: number[]): string[] {
  // a lone solution (sin x = −1) is mistaken for another quadrantal angle
  const more = [sols.slice(0, -1), sols.slice(1), sols.map(x => (x + 90) % 360), sols.map(x => (x + 180) % 360), sols.map(x => (360 - x) % 360), ...(sols.length === 1 ? [[0], [90], [180], [270]] : [])];
  return wrongsFrom(ans, [...slips, ...more].filter(s => s.length > 0).map(degs), j => degs([...sols, (sols[sols.length - 1]! + 15 * Math.abs(j)) % 360]));
}

/**
 * Equations the book solves with the special angles: a sin x + b = c (and cos,
 * and tan), one that factors with a common ratio (the book's «أكتشف الخطأ»:
 * dividing by sin x loses sin x = 0), and quadratics in sin x or cos x.
 */
const trigEquations = T('g10_trig_equations', /^حل المعادلات المثلثيه$/, ({ rng }) => {
  const k = pick(rng, [0, 1, 2, 3]);
  const ask = (eq: string): Pick<Draft, 'ar' | 'en'> => ({ ar: `ما حلول المعادلة ${eq} ${INTERVAL}؟`, en: `Solve ${eq} for 0° ≤ x < 360°.` });
  if (k === 0) {
    const fn = pick(rng, ['sin', 'cos'] as const), other = fn === 'sin' ? 'cos' : 'sin';
    const form = pick(rng, [0, 1, 2]);
    let eq: string, v: number;
    if (form === 0) {
      v = pick(rng, [0.5, -0.5]);
      const A = 2 * int(rng, 1, 3), B = nz(rng, 9);
      eq = `${A} ${fn} x ${tail(B)} = ${signed(A * v + B)}`;
    } else if (form === 1) {
      v = pick(rng, [1, -1]);
      const A = int(rng, 2, 5), B = nz(rng, 9);
      eq = `${A} ${fn} x ${tail(B)} = ${signed(A * v + B)}`;
    } else if (rng() < 0.5) {
      const s = pick(rng, [1, -1]);
      v = -s * R3;
      eq = `2 ${fn} x ${tail(s > 0 ? '√3' : '−√3')} = 0`;
    } else {
      const s = pick(rng, [1, -1]);
      v = -s * R2;
      eq = `√2 ${fn} x ${tail(s)} = 0`;
    }
    const sols = solve(fn, v), ans = degs(sols);
    return { eq, answer: ans, wrongs: setOpts(ans, [[sols[0]!], solve(other, v), solve(fn, -v)], sols), ...ask(eq) };
  }
  if (k === 1) {
    let eq: string, v: number;
    if (rng() < 0.5) {
      v = pick(rng, [1, -1]);
      const A = int(rng, 1, 4), B = nz(rng, 9);
      eq = `${A === 1 ? '' : `${A} `}tan x ${tail(B)} = ${signed(A * v + B)}`;
    } else if (rng() < 0.5) {
      const s = pick(rng, [1, -1]);
      v = -s * Math.sqrt(3);
      eq = `tan x ${tail(s > 0 ? '√3' : '−√3')} = 0`;
    } else {
      const s = pick(rng, [1, -1]);
      v = -s / Math.sqrt(3);
      eq = `√3 tan x ${tail(s)} = 0`;
    }
    const sols = solve('tan', v), ans = degs(sols), a0 = sols[0]!;
    return { eq, answer: ans, wrongs: setOpts(ans, [[a0], solve('tan', -v), [a0, 180 - a0], [a0, 360 - a0]], sols), ...ask(eq) };
  }
  if (k === 2) {
    const f1 = pick(rng, ['sin', 'cos'] as const), f2 = pick(rng, ['sin', 'cos'] as const);
    const form = pick(rng, [0, 1, 2]), s = pick(rng, [1, -1]);
    const [inner, v] = form === 0 ? [`2 ${f2} x ${tail(s)}`, -s / 2] : form === 1 ? [`2 ${f2} x ${tail(s > 0 ? '√3' : '−√3')}`, -s * R3] : [`√2 ${f2} x ${tail(s)}`, -s * R2];
    const eq = `${f1} x (${inner}) = 0`;
    const sols = [...new Set([...solve(f1, 0), ...solve(f2, v)])].sort((x, y) => x - y), ans = degs(sols);
    return { eq, answer: ans, wrongs: setOpts(ans, [solve(f2, v), [...solve(f1, 0), ...solve(f2, -v)], solve(f1, 0)], sols), ...ask(eq) };
  }
  const fn = pick(rng, ['sin', 'cos'] as const);
  if (rng() < 0.5) {
    // (2u − n1)(2u − n2) = 0, u = sin x or cos x, the roots n/2 in [−1, 1]
    const [n1, n2] = shuffle(rng, [-2, -1, 0, 1, 2]).slice(0, 2) as [number, number];
    let A = 4, B = -2 * (n1 + n2), C = n1 * n2;
    const g = [A, B, C].filter(x => x !== 0).reduce((x, y) => { let p = Math.abs(x), q = Math.abs(y); while (q) [p, q] = [q, p % q]; return p; });
    [A, B, C] = [A / g, B / g, C / g];
    const mid = B === 0 ? '' : ` ${B < 0 ? '−' : '+'} ${Math.abs(B) === 1 ? '' : `${Math.abs(B)} `}${fn} x`;
    const eq = `${A === 1 ? '' : `${A} `}${fn}² x${mid}${C === 0 ? '' : ` ${tail(C)}`} = 0`;
    const r1 = solve(fn, n1 / 2), r2 = solve(fn, n2 / 2);
    const sols = [...new Set([...r1, ...r2])].sort((x, y) => x - y), ans = degs(sols);
    return { eq, answer: ans, wrongs: setOpts(ans, [r1, r2, [...solve(fn, -n1 / 2), ...solve(fn, -n2 / 2)]], sols), ...ask(eq) };
  }
  // a fn² x − c = 0: both signs of the square root
  const sq2 = pick(rng, ['tan', fn] as const);
  const [A, C, v] = sq2 === 'tan' ? pick(rng, [[1, 1, 1], [1, 3, Math.sqrt(3)], [3, 1, 1 / Math.sqrt(3)]] as Array<[number, number, number]>) : pick(rng, [[4, 1, 0.5], [2, 1, R2], [4, 3, R3]] as Array<[number, number, number]>);
  const eq = `${A === 1 ? '' : `${A} `}${sq2}² x − ${C} = 0`;
  const plus = solve(sq2, v), sols = [...new Set([...plus, ...solve(sq2, -v)])].sort((x, y) => x - y), ans = degs(sols);
  return { eq, answer: ans, wrongs: setOpts(ans, [plus, [plus[0]!, solve(sq2, -v)[0]!]], sols), ...ask(eq) };
});

// ─── «قانون الجيوب» (S1 pp. 106-112) ─────────────────────────────────────────

const SINE_ANGLES = [30, 45, 60, 90, 120, 135];
const sinD = (d: number) => Math.sin(rad(d));
const cosD = (d: number) => Math.cos(rad(d));

/**
 * The sine rule a/sin A = b/sin B: a side from a side and two angles, the same
 * when the angle opposite the wanted side must first come from the angle sum,
 * and an angle from two sides and an angle opposite one of them — only where
 * the other angle is larger, so the obtuse twin of the answer cannot fit.
 */
const sineLaw = T('g10_sine_law', /^قانون الجيوب$/, ({ rng }) => {
  const k = pick(rng, [0, 1, 2]);
  if (k === 2) {
    for (;;) {
      const A = pick(rng, SINE_ANGLES), B = pick(rng, [30, 45, 60]);
      if (B >= A || A + B >= 180) continue;
      const b = int(rng, 2, 12), a = asSurd((b * sinD(A)) / sinD(B));
      if (!a) continue;
      return {
        eq: `a ${a.s}, b ${b}, A ${A}`, answer: dg(B),
        wrongs: degOpts(B, [180 - B, 90 - B, A, 2 * B], 0, 180),
        ar: `في المثلث ABC: طول الضلع a يساوي ${a.s} سم، وطول الضلع b يساوي ${b} سم، وقياس الزاوية A يساوي ${A}°. ما قياس الزاوية B؟`,
        en: `In triangle ABC, a = ${a.s} cm, b = ${b} cm and A = ${A}°. What is angle B?`,
      };
    }
  }
  for (;;) {
    const A = pick(rng, SINE_ANGLES), B = pick(rng, SINE_ANGLES);
    if (A === B || A + B >= 180) continue;
    const C = 180 - A - B, a = int(rng, 2, 14);
    const b = asSurd((a * sinD(B)) / sinD(A));
    if (!b) continue;
    const slips = [(a * sinD(A)) / sinD(B), a * sinD(B), Math.abs(cosD(A)) > 1e-9 ? Math.abs((a * cosD(B)) / cosD(A)) : NaN, a, k === 1 ? (a * sinD(C)) / sinD(A) : NaN];
    const wrongs = wrongsFrom(b.s, slips.map(x => (Number.isFinite(x) && x > 0 ? asSurd(x)?.s ?? '' : '')), surdNear(b.c, b.r));
    if (k === 0) {
      return {
        eq: `A ${A}, B ${B}, a ${a}`, answer: b.s, wrongs,
        ar: `في المثلث ABC: قياس الزاوية A يساوي ${A}°، وقياس الزاوية B يساوي ${B}°، وطول الضلع a يساوي ${a} سم. ما طول الضلع b؟`,
        en: `In triangle ABC, A = ${A}°, B = ${B}° and a = ${a} cm. How long is side b?`,
      };
    }
    return {
      eq: `A ${A}, C ${C}, a ${a}`, answer: b.s, wrongs,
      ar: `في المثلث ABC: قياس الزاوية A يساوي ${A}°، وقياس الزاوية C يساوي ${C}°، وطول الضلع a يساوي ${a} سم. ما طول الضلع b؟`,
      en: `In triangle ABC, A = ${A}°, C = ${C}° and a = ${a} cm. How long is side b?`,
    };
  }
});

// ─── «قانون جيب التمام» (S1 pp. 113-118) ─────────────────────────────────────

/** c² = a² + b² − 2ab cos C with cos C = ½, 0 or −½: whole numbers throughout. */
const cSquared = (a: number, b: number, C: number) => a * a + b * b - (C === 60 ? a * b : C === 120 ? -a * b : 0);
/** [a, b, C, c] with a whole third side. */
const WHOLE_TRIANGLES: Array<[number, number, number, number]> = [];
for (let a = 2; a <= 16; a++) {
  for (let b = a + 1; b <= 16; b++) {
    for (const C of [60, 90, 120]) {
      const c2 = cSquared(a, b, C), c = Math.round(Math.sqrt(c2));
      if (c * c === c2) WHOLE_TRIANGLES.push([a, b, C, c]);
    }
  }
}
const cosWrongs = (ans: string, a: number, b: number, C: number) =>
  wrongsFrom(ans, [root(cSquared(a, b, C === 60 ? 120 : C === 120 ? 60 : 60)), root(a * a + b * b), String(a + b), String(cSquared(a, b, C))], j => root(cSquared(a, b, C) + Math.abs(j)));

/**
 * The cosine rule: the third side from two sides and the angle between them,
 * an angle from three sides, and two of the book's problems — the distance
 * between the tips of a clock's hands, and between two ships.
 */
const cosineLaw = T('g10_cosine_law', /^قانون جيب التمام$/, ({ rng }) => {
  const k = pick(rng, [0, 1, 2, 3]);
  if (k === 0) {
    const a = int(rng, 2, 12), b = int(rng, 2, 12), C = pick(rng, [60, 120]);
    const ans = root(cSquared(a, b, C));
    return {
      eq: `a ${a}, b ${b}, C ${C}`, answer: ans, wrongs: cosWrongs(ans, a, b, C),
      ar: `في المثلث ABC: طول الضلع a يساوي ${a} سم، وطول الضلع b يساوي ${b} سم، وقياس الزاوية C يساوي ${C}°. ما طول الضلع c؟`,
      en: `In triangle ABC, a = ${a} cm, b = ${b} cm and C = ${C}°. How long is side c?`,
    };
  }
  if (k === 1) {
    const [a, b, C, c] = pick(rng, WHOLE_TRIANGLES);
    return {
      eq: `${a}, ${b}, ${c}`, answer: dg(C),
      wrongs: degOpts(C, [180 - C, 30, 45, 90, 150], 0, 180, 15),
      ar: `أطوال أضلاع المثلث ABC هي: a = ${a} سم، b = ${b} سم، c = ${c} سم. ما قياس الزاوية C؟`,
      en: `Triangle ABC has sides a = ${a} cm, b = ${b} cm and c = ${c} cm. What is angle C?`,
    };
  }
  if (k === 2) {
    const p = int(rng, 2, 6), q = int(rng, p + 1, 10), h = pick(rng, [2, 3, 4, 8, 9, 10]);
    const C = 30 * Math.min(h, 12 - h), ans = root(cSquared(p, q, C));
    return {
      eq: `clock ${p}, ${q}, ${h}`, answer: ans, wrongs: cosWrongs(ans, p, q, C),
      ar: `طول عقرب الساعات في ساعة حائط ${p} سم، وطول عقرب الدقائق ${q} سم. ما المسافة بين رأسي العقربين عندما تشير الساعة إلى ${h}:00 تمامًا؟`,
      en: `A wall clock's hour hand is ${p} cm long and its minute hand ${q} cm. How far apart are the tips of the hands at exactly ${h}:00?`,
    };
  }
  const [a, b, C, c] = pick(rng, WHOLE_TRIANGLES.filter(t => t[2] !== 90));
  return {
    eq: `ships ${C}, ${a}, ${b}`, answer: String(c), wrongs: cosWrongs(String(c), a, b, C),
    ar: `انطلقت سفينتان من ميناء في اللحظة نفسها، وقياس الزاوية بين مساريهما ${C}°. إذا قطعت الأولى ${a} km وقطعت الثانية ${b} km، فما المسافة بينهما بالكيلومترات؟`,
    en: `Two ships leave a port at the same moment on courses ${C}° apart. When one has sailed ${a} km and the other ${b} km, how many kilometres apart are they?`,
  };
});

// ─── «حل مسائل ثلاثية الأبعاد» (S1 pp. 124-129) ───────────────────────────────

/** Cuboids with a whole space diagonal: [l, w, h, diagonal]. */
const CUBOIDS: Array<[number, number, number, number]> = [[1, 2, 2, 3], [2, 3, 6, 7], [1, 4, 8, 9], [4, 4, 7, 9], [2, 6, 9, 11], [6, 6, 7, 11], [3, 4, 12, 13], [2, 5, 14, 15], [2, 10, 11, 15], [8, 9, 12, 17], [4, 13, 16, 21]];
/** Square pyramids with a whole height: [base side, lateral edge, height]. h² = l² − s²/2. */
const PYRAMIDS: Array<[number, number, number]> = [];
for (let s = 4; s <= 20; s += 2) {
  const half = (s * s) / 2;
  for (let d = 1; d * d < half; d++) {
    if (half % d !== 0) continue;
    const e = half / d;
    if ((e - d) % 2 === 0) PYRAMIDS.push([s, (d + e) / 2, (e - d) / 2]);
  }
}
const deg1 = (r: number) => `${((r * 180) / Math.PI).toFixed(1)}°`;

/**
 * Right triangles inside solids: a face diagonal, the space diagonal of a
 * cuboid, the angle between that diagonal and the base (to a tenth of a degree,
 * as the book rounds it), and the height of a square pyramid from its edges.
 */
const solids3d = T('g10_3d', /^حل مسائل ثلاثيه الابعاد$/, ({ rng, diff }) => {
  const k = pick(rng, [0, 1, 2, 3]);
  const m = diff === 'easy' ? 1 : pick(rng, [1, 2, 3]);
  if (k === 0) {
    const [l0, w0, h0, d0] = pick(rng, CUBOIDS);
    const [l, w, h] = shuffle(rng, [l0 * m, w0 * m, h0 * m]) as [number, number, number], d = d0 * m;
    const face = Math.sqrt(l * l + w * w);
    return {
      eq: `${l}, ${w}, ${h}`, answer: String(d),
      wrongs: pos(d, [l + w + h, d * d, Number.isInteger(face) ? face : d + 2, d + 1]),
      ar: `متوازي مستطيلات أبعاده ${l} سم و ${w} سم و ${h} سم. ما طول قطره الواصل بين رأسين متقابلين؟`,
      en: `A cuboid measures ${l} cm by ${w} cm by ${h} cm. How long is its diagonal joining two opposite vertices?`,
    };
  }
  if (k === 1) {
    const [p0, q0, r0] = pick(rng, TRIPLES);
    const [p, q] = rng() < 0.5 ? [p0 * m, q0 * m] : [q0 * m, p0 * m], r = r0 * m;
    return {
      eq: `EF ${p}, EH ${q}`, answer: String(r),
      wrongs: pos(r, [p + q, r * r, Math.abs(q - p), r + 1]),
      ar: `في متوازي المستطيلات ABCDEFGH قاعدته المستطيل EFGH، فيه EF = ${p} سم و EH = ${q} سم. ما طول القطر FH؟`,
      en: `In cuboid ABCDEFGH the base EFGH is a rectangle with EF = ${p} cm and EH = ${q} cm. How long is the diagonal FH?`,
    };
  }
  if (k === 2) {
    const [p, q, d] = pick(rng, TRIPLES);
    let h = int(rng, 2, 15);
    if (h === d) h += 1;
    const t = Math.atan(h / d);
    const ans = deg1(t);
    return {
      eq: `${p}, ${q}, ${h}`, answer: ans,
      wrongs: wrongsFrom(ans, [deg1(Math.PI / 2 - t), deg1(Math.atan(h / p)), deg1(Math.atan(h / q)), deg1(Math.atan(h / (p + q)))], j => deg1(t + rad(Math.abs(j)))),
      ar: `متوازي مستطيلات قاعدته مستطيل بُعداه ${p} سم و ${q} سم، وارتفاعه ${h} سم. ما قياس الزاوية بين قطره وقاعدته، مقرّبًا إلى أقرب عُشر درجة؟`,
      en: `A cuboid has a rectangular base ${p} cm by ${q} cm and height ${h} cm. What angle does its diagonal make with the base, to the nearest tenth of a degree?`,
    };
  }
  const [s, l, h] = pick(rng, PYRAMIDS);
  const slant = Math.sqrt(l * l - (s / 2) ** 2);
  return {
    eq: `pyramid ${s}, ${l}`, answer: String(h),
    wrongs: pos(h, [Number.isInteger(slant) ? slant : l - 1, l - s / 2, h * h, h + 1]),
    ar: `هرم رباعي قاعدته مربع طول ضلعه ${s} سم، وطول كل حرف من أحرفه الجانبية ${l} سم. ما ارتفاع الهرم؟`,
    en: `A square pyramid has a base of side ${s} cm and lateral edges of ${l} cm. What is its height?`,
  };
});

// ─── «اقترانات كثيرات الحدود» (S2 pp. 8-17) ──────────────────────────────────

/** A polynomial written out of order, as the book's first example is: [terms as written, degree, leading coefficient, constant]. */
function unordered(rng: Rng, diff: D): { list: Array<[number, number]>; n: number; lead: number; c0: number } {
  const n = int(rng, diff === 'easy' ? 2 : 3, diff === 'hard' ? 6 : 4);
  const mids = shuffle(rng, Array.from({ length: n - 1 }, (_, i) => i + 1)).slice(0, int(rng, 1, Math.min(2, n - 1)));
  const list = shuffle(rng, [n, 0, ...mids].map(e => [nz(rng, 9), e] as [number, number]));
  // never in standard form already: the leading term is not written first
  if (list[0]![1] === n) list.push(list.shift()!);
  return { list, n, lead: list.find(t => t[1] === n)![0], c0: list.find(t => t[1] === 0)![0] };
}
const MOTION = (q: string) => `يمثل الاقتران s(t) = ${q} موقع جسم يتحرك في مسار مستقيم، حيث s بالأمتار و t بالثواني.`;
const MOTION_EN = (q: string) => `s(t) = ${q} gives the position, in metres, of a body moving in a straight line after t seconds.`;
const xe = (e: number) => `x${e === 1 ? '' : sup(e)}`;

/**
 * Degree, leading coefficient and constant term of a polynomial written out of
 * order; adding, subtracting and multiplying polynomials (one coefficient of
 * the result); and the book's position function s(t) — where the body is after
 * t seconds, and when it is at the origin.
 */
const polynomials = T('g10_polynomials', /^اقترانات كثيرات الحدود$/, ({ rng, diff }) => {
  const k = pick(rng, [0, 1, 2, 3, 4, 5, 6]);
  if (k <= 2) {
    const { list, n, lead, c0 } = unordered(rng, diff);
    const P = terms(list);
    if (k === 0) {
      return {
        eq: P, answer: String(n),
        wrongs: pos(n, [list.length, list[0]![1], Math.abs(lead), n + 1]),
        ar: `ما درجة كثير الحدود ${P}؟`, en: `What is the degree of the polynomial ${P}?`,
      };
    }
    if (k === 1) {
      return {
        eq: P, answer: signed(lead),
        wrongs: wrongsFrom(signed(lead), [list[0]![0], c0, -lead, n].map(signed), j => (lead + j === 0 ? '' : signed(lead + j))),
        ar: `ما المعامل الرئيس لكثير الحدود ${P}؟`, en: `What is the leading coefficient of ${P}?`,
      };
    }
    return {
      eq: P, answer: signed(c0),
      wrongs: wrongsFrom(signed(c0), [lead, -c0, list[0]![0], n].map(signed), j => (c0 + j === 0 ? '' : signed(c0 + j))),
      ar: `ما الحد الثابت في كثير الحدود ${P}؟`, en: `What is the constant term of ${P}?`,
    };
  }
  if (k === 3) {
    const t = int(rng, 3, 9);
    const cs = rng() < 0.5 ? [int(rng, 1, 5), nz(rng, 30), int(rng, 0, 40)] : [1, nz(rng, 9), nz(rng, 20), 0];
    const Q = desc(cs, 't'), v = evalDesc(cs, t);
    const c0 = cs[cs.length - 1]!;
    return {
      eq: `${Q} t=${t}`, answer: signed(v),
      wrongs: sgn(v, [evalDesc(cs, -t), v - c0, cs.length === 3 ? cs[0]! * 2 * t + cs[1]! * t + c0 : evalDesc(cs, t - 1), -v]),
      ar: `${MOTION(Q)} ما موقع الجسم بعد ${t} ثوانٍ؟`,
      en: `${MOTION_EN(Q)} Where is the body after ${t} seconds?`,
    };
  }
  if (k === 4) {
    const p = int(rng, 1, 5), q = int(rng, p + 1, 9), m = int(rng, 1, 4);
    const cs = [m, -m * (p + q), m * p * q], Q = desc(cs, 't');
    const ans = `t = ${p} ، t = ${q}`;
    return {
      eq: Q, answer: ans,
      wrongs: wrongsFrom(ans, [`t = ${signed(-p)} ، t = ${signed(-q)}`, `t = 0 ، t = ${p + q}`, m > 1 ? `t = ${m * p} ، t = ${m * q}` : `t = ${q - p} ، t = ${p + q}`, `t = ${p * q}`]),
      ar: `${MOTION(Q)} متى يكون الجسم عند نقطة الأصل؟`,
      en: `${MOTION_EN(Q)} When is the body at the origin?`,
    };
  }
  if (k === 5) {
    const f = [nz(rng, 9), nz(rng, 9), nz(rng, 9), nz(rng, 9)], g = [nz(rng, 9), nz(rng, 9), nz(rng, 9), nz(rng, 9)];
    const e = int(rng, 1, 3), fe = f[3 - e]!, ge = g[3 - e]!;
    const minus = rng() < 0.5, ans = minus ? fe - ge : fe + ge;
    const F = terms(shuffle(rng, f.map((c, i) => [c, 3 - i] as [number, number]))), G = desc(g);
    return {
      eq: `${F} ; ${G}`, answer: signed(ans),
      wrongs: sgn(ans, [minus ? fe + ge : fe - ge, minus ? ge - fe : -fe - ge, fe, ge]),
      ar: `إذا كان f(x) = ${F} و g(x) = ${G}، فما معامل ${xe(e)} في ${minus ? 'f(x) − g(x)' : 'f(x) + g(x)'}؟`,
      en: `If f(x) = ${F} and g(x) = ${G}, what is the coefficient of ${xe(e)} in ${minus ? 'f(x) − g(x)' : 'f(x) + g(x)'}?`,
    };
  }
  if (rng() < 0.5) {
    // a monomial times a trinomial, by the distributive law
    const m = nz(rng, 6), p = int(rng, 1, 3), [a, b, c] = [nz(rng, 9), nz(rng, 9), nz(rng, 9)];
    const A = terms([[m, p]]), B = desc([a, b, c]);
    return {
      eq: `(${A})(${B})`, answer: signed(m * b),
      wrongs: sgn(m * b, [m * a, m * c, m + b, -m * b]),
      ar: `ما معامل ${xe(p + 1)} في ناتج ضرب (${A}) في (${B})؟`,
      en: `What is the coefficient of ${xe(p + 1)} in the product (${A})(${B})?`,
    };
  }
  const [a, b, c, d] = [int(rng, 1, 6), nz(rng, 9), int(rng, 1, 6), nz(rng, 9)];
  const A = desc([a, b]), B = desc([c, d]), ans = a * d + b * c;
  return {
    eq: `(${A})(${B})`, answer: signed(ans),
    wrongs: sgn(ans, [a * d, b * c, b * d, a * d - b * c, a * c]),
    ar: `ما معامل x في ناتج ضرب (${A}) في (${B})؟`,
    en: `What is the coefficient of x in the product (${A})(${B})?`,
  };
});

// ─── «قسمة كثيرات الحدود والاقترانات النسبية» (S2 pp. 18-24) ──────────────────

/**
 * Dividing a polynomial by x − a (the quotient, and the remainder), the domain
 * of a rational function, its vertical and horizontal asymptotes in the book's
 * form a/(x − b) + c, and the hole a common factor leaves.
 */
const rational = T('g10_rational', /^(?:قسمه كثيرات الحدود و)?الاقترانات النسبيه$/, ({ rng, diff }) => {
  const k = pick(rng, [0, 1, 2, 3, 4, 5]);
  if (k === 0) {
    const r = nz(rng, diff === 'easy' ? 3 : 5);
    const cs = rng() < 0.5 ? [int(rng, 1, 3), int(rng, -6, 6), int(rng, -9, 9), nz(rng, 20)] : [1, nz(rng, 9), nz(rng, 20)];
    const F = desc(cs), rem = evalDesc(cs, r), c0 = cs[cs.length - 1]!;
    return {
      eq: `${F} ÷ ${lin(r)}`, answer: signed(rem),
      wrongs: sgn(rem, [evalDesc(cs, -r), c0, rem - c0, -rem]),
      ar: `ما باقي قسمة f(x) = ${F} على ${lin(r)}؟`,
      en: `What is the remainder when f(x) = ${F} is divided by ${lin(r)}?`,
    };
  }
  if (k === 1) {
    const r = nz(rng, 6);
    // the book's example has a missing x² term (2x³ + 24x − 15): a zero kept in its place
    const cs = rng() < 0.5 ? [1, nz(rng, 9), nz(rng, 20)] : [int(rng, 1, 3), 0, nz(rng, 30), nz(rng, 20)];
    const F = desc(cs), [q] = synth(cs, r), ans = desc(q);
    const slips = [desc(synth(cs, -r)[0]), cs.includes(0) ? desc(synth(cs.filter(c => c !== 0), r)[0]) : desc(q.map((c, i) => (i === 0 ? c : -c)))];
    return {
      eq: `${F} ÷ ${lin(r)}`, answer: ans,
      wrongs: wrongsFrom(ans, slips, j => desc([...q.slice(0, -1), q[q.length - 1]! + j])),
      ar: `ما ناتج قسمة ${F} على ${lin(r)}، دون الباقي؟`,
      en: `What is the quotient, without the remainder, when ${F} is divided by ${lin(r)}?`,
    };
  }
  if (k === 2) {
    const p = int(rng, -6, 6);
    let q = int(rng, -6, 6);
    if (q === p) q = p + 1;
    let n = nz(rng, 9);
    while (n === -p || n === -q) n += 1;
    const [lo, hi] = [Math.min(p, q), Math.max(p, q)];
    const N = desc([1, n]), Dn = desc([1, -(p + q), p * q]);
    const ans = `${signed(lo)} ، ${signed(hi)}`;
    const pair = (x: number, y: number) => (x === y ? signed(x) : `${signed(Math.min(x, y))} ، ${signed(Math.max(x, y))}`);
    return {
      eq: `(${N})/(${Dn})`, answer: ans,
      wrongs: wrongsFrom(ans, [pair(-p, -q), signed(-n), pair(-n, hi), signed(hi), pair(p * q, p + q)], j => pair(lo, hi + Math.abs(j))),
      ar: `ما الأعداد الحقيقية المستثناة من مجال الاقتران f(x) = (${N})/(${Dn})؟`,
      en: `Which real numbers are excluded from the domain of f(x) = (${N})/(${Dn})?`,
    };
  }
  if (k === 5) {
    const p = nz(rng, 6);
    let q = nz(rng, 6);
    while (q === p || q === -p) q = nz(rng, 6);
    const N = desc([1, -(p + q), p * q]);
    const at = (x: number) => `x = ${signed(x)}`;
    return {
      eq: `(${N})/(${lin(p)})`, answer: at(p),
      wrongs: [at(q), at(-p), at(-q)],
      ar: `عند أي قيمة لـ x توجد فجوة في منحنى الاقتران f(x) = (${N})/(${lin(p)})؟`,
      en: `At what value of x does the graph of f(x) = (${N})/(${lin(p)}) have a hole?`,
    };
  }
  // a/(x − b) + c: x = b vertical, y = c horizontal; or px/(x − b), which long division makes p + pb/(x − b)
  const vertical = k === 3;
  const b = nz(rng, 6);
  let c = nz(rng, 6);
  while (c === b || c === -b) c = nz(rng, 6);
  let f: string;
  if (!vertical && rng() < 0.4) {
    c = int(rng, 2, 9);
    while (c === b || c === -b) c += 1;
    f = `${c}x/(${lin(b)})`;
  } else {
    f = `${signed(nz(rng, 9))}/(${lin(b)}) ${tail(c)}`;
  }
  const kind = vertical ? 'الرأسي' : 'الأفقي';
  const ans = vertical ? `x = ${signed(b)}` : `y = ${signed(c)}`;
  return {
    eq: f, answer: ans,
    wrongs: vertical ? [`x = ${signed(-b)}`, `x = ${signed(c)}`, `y = ${signed(b)}`] : [`y = ${signed(b)}`, `y = ${signed(-c)}`, `x = ${signed(c)}`],
    ar: `ما معادلة خط التقارب ${kind} لمنحنى الاقتران f(x) = ${f}؟`,
    en: `What is the equation of the ${vertical ? 'vertical' : 'horizontal'} asymptote of f(x) = ${f}?`,
  };
});

export const G10_LESSON_TOPICS: readonly Topic[] = [
  circleEquation, trigRatios, trigFullTurn, trigGraphs, trigEquations, sineLaw, cosineLaw, solids3d, polynomials, rational,
  // the second batch, 2026-11-14: the lessons still on a thin shared family (`grade10b.ts`)
  ...G10B_TOPICS,
];

/**
 * The Grade 10 lessons whose own generator serves their questions ahead of the
 * shared bank family (`takeConcreteMath`). Every other Grade 10 lesson keeps
 * the bank exactly as it was; add a lesson here only with a generator for it.
 */
export const G10_LESSON_FIRST: ReadonlySet<string> = new Set(G10_LESSON_TOPICS.map(t => t.id));
