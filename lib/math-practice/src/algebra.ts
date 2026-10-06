/**
 * Algebra topic generators (Grades 4–9): expressions, equations, polynomials,
 * factoring, inequalities, systems, lines, quadratics, exponents, radicals and
 * rational expressions. Same contract as `topics.ts`: the lesson title picks
 * the generator, every answer is computed from the numbers in the stem.
 *
 * Each generator builds its stem from a chosen solution (a root, a point, a
 * product), so the answer is known by construction — and `algebra.test.ts`
 * recomputes it from the printed stem by a different route.
 */
import { gcd, int, lcm, nz, pick, sfrac, signed, sup, tier, wrongsFrom, type Draft, type Rng, type Topic } from './topicKit.ts';

// ─── polynomial and expression formatting ───────────────────────────────────

/** «3x² − 5x + 2» from coefficients, constant term first. */
export function polyStr(co: number[], v = 'x'): string {
  const parts: string[] = [];
  for (let p = co.length - 1; p >= 0; p--) {
    const c = co[p] ?? 0;
    if (!c) continue;
    const a = Math.abs(c);
    const body = p === 0 ? String(a) : `${a === 1 ? '' : a}${v}${p === 1 ? '' : sup(p)}`;
    parts.push(parts.length === 0 ? (c < 0 ? `−${body}` : body) : ` ${c < 0 ? '−' : '+'} ${body}`);
  }
  return parts.length ? parts.join('') : '0';
}

const trim = (c: number[]) => { const r = c.slice(); while (r.length && !r[r.length - 1]) r.pop(); return r; };

/** Three wrong polynomials: the candidates, then the answer with one coefficient nudged. */
function polyOpts(ans: number[], cands: number[][], v = 'x'): string[] {
  const seen = new Set([trim(ans).join(',')]);
  const out: string[] = [];
  const take = (c: number[]) => {
    const n = trim(c);
    if (n.length === 0 || seen.has(n.join(','))) return;
    seen.add(n.join(','));
    out.push(polyStr(n, v));
  };
  cands.forEach(take);
  for (let k = 1; out.length < 3 && k < 30; k++) {
    for (let i = 0; i < ans.length && out.length < 3; i++) {
      const up = ans.slice(); up[i] = (up[i] ?? 0) + k; take(up);
      const dn = ans.slice(); dn[i] = (dn[i] ?? 0) - k; take(dn);
    }
  }
  return out.slice(0, 3);
}

const mul = (a: number[], b: number[]) => {
  const r = new Array(a.length + b.length - 1).fill(0) as number[];
  a.forEach((x, i) => b.forEach((y, j) => { r[i + j]! += x * y; }));
  return r;
};
const add = (a: number[], b: number[], s = 1) => {
  const r = new Array(Math.max(a.length, b.length)).fill(0) as number[];
  for (let i = 0; i < r.length; i++) r[i] = (a[i] ?? 0) + s * (b[i] ?? 0);
  return r;
};

/** «(2x − 3)» — a linear factor mx + p. */
const fac = (m: number, p: number) => `(${m === 1 ? '' : m}x ${p < 0 ? '−' : '+'} ${Math.abs(p)})`;
/** «2x + 3» or «x − 4», no brackets. */
const lin = (m: number, p: number, v = 'x') => polyStr([p, m], v);
/** «ax + by = c» with the signs written out. */
const lineEq = (a: number, b: number, c: number) => `${polyStr([0, a], 'x')}${b < 0 ? ' − ' : ' + '}${Math.abs(b) === 1 ? '' : Math.abs(b)}y = ${signed(c)}`;
const pair = (x: number, y: number) => `(${signed(x)} ، ${signed(y)})`;
/** «k√m», «√m», «−√m». */
const rad = (k: number, m: number) => (k === 0 ? '0' : `${k === 1 ? '' : k === -1 ? '−' : signed(k)}√${m}`);

const span = (diff: DiffTierLike) => (diff === 'easy' ? 6 : diff === 'medium' ? 9 : 12);
type DiffTierLike = 'easy' | 'medium' | 'hard';

type Gen = (c: { rng: Rng; diff: DiffTierLike; grade: number }) => Draft;
const topic = (id: string, match: RegExp, grades: [number, number], make: Gen): Topic => ({ id, match, grades, make });

/** Numeric options. Plain counts (`String`) never get a negative option; signed answers may. */
const num = (answer: number, cands: number[], fmt: (n: number) => string = signed) =>
  wrongsFrom(fmt(answer), cands.filter(c => Number.isFinite(c) && (fmt === signed || c >= 0)).map(fmt), k => fmt(answer + Math.abs(k)));

// ─── Grades 4–7: expressions, equations, sequences ──────────────────────────

const exprG4 = topic('expr_g4', /^المقادير والمتغيرات$/, [4, 4], ({ rng, diff }) => {
  const v = pick(rng, ['n', 'x', 'a', 'b']);
  const k = int(rng, 2, span(diff)), a = int(rng, 2, 9);
  const form = pick(rng, [0, 1, 2]);
  const [text, ans] = form === 0 ? [`${v} + ${a}`, k + a] : form === 1 ? [`${a} × ${v}`, a * k] : [`${v} − ${a}`, k - a];
  if (form === 2 && k <= a) return exprG4.make({ rng, diff, grade: 4 });
  return {
    eq: text as string, answer: String(ans), wrongs: num(ans as number, [(ans as number) + 1, (ans as number) - 1, k, a + k + 1], String),
    ar: `أوجد قيمة المقدار ${text} عندما ${v} = ${k}.`, en: `Find the value of ${text} when ${v} = ${k}.`,
  };
});

const exprEval = topic('expr_eval', /قيمه المقدار الجبري/, [5, 6], ({ rng, diff }) => {
  const x = int(rng, 2, span(diff)), y = int(rng, 2, 9), a = int(rng, 2, 9), b = int(rng, 1, 9);
  const two = tier(diff) >= 1 && rng() < 0.6;
  if (two) {
    const text = `${a}x + ${b}y`;
    const v = a * x + b * y;
    return { eq: text, answer: String(v), wrongs: num(v, [a + x + b + y, a * (x + b) * y, a * x * b * y, v + a], String), ar: `أوجد قيمة المقدار ${text} عندما x = ${x} و y = ${y}.`, en: `Find the value of ${text} when x = ${x} and y = ${y}.` };
  }
  const text = `${a}x + ${b}`;
  const v = a * x + b;
  return { eq: text, answer: String(v), wrongs: num(v, [a + x + b, a * (x + b), a + b * x, v + a], String), ar: `أوجد قيمة المقدار ${text} عندما x = ${x}.`, en: `Find the value of ${text} when x = ${x}.` };
});

/** One-step equations from a chosen solution. */
const oneStep = (id: string, match: RegExp, kinds: Array<'add' | 'sub' | 'mul' | 'div'>, grades: [number, number]) =>
  topic(id, match, grades, ({ rng, diff }) => {
    const x = int(rng, 2, span(diff) + 6), a = int(rng, 2, span(diff));
    const kind = pick(rng, kinds);
    // [equation, answer, the usual wrong answers: doing the same operation again, using the right-hand side, using a]
    const [eq, ans, w] = (kind === 'add' ? [`x + ${a} = ${x + a}`, x, [x + 2 * a, x + a, a]]
      : kind === 'sub' ? [`x − ${a} = ${x}`, x + a, [x - a, x, a]]
      : kind === 'mul' ? [`${a}x = ${a * x}`, x, [a * x - a, a * x, a]]
      : [`x ÷ ${a} = ${x}`, x * a, [x + a, x, x - a]]) as [string, number, number[]];
    return { eq, answer: String(ans), wrongs: num(ans, w, String), ar: `حلّ المعادلة: ${eq}`, en: `Solve the equation: ${eq}` };
  });

const equations = topic('eq_mixed', /^المعادلات$/, [4, 6], ({ rng, diff, grade }) => {
  if (grade < 6) return oneStep('x', /./, ['add', 'sub', 'mul', 'div'], [4, 5]).make({ rng, diff, grade });
  const x = int(rng, 1, 9), a = int(rng, 2, 6), b = int(rng, 1, 12);
  const eq = `${a}x + ${b} = ${a * x + b}`;
  return { eq, answer: String(x), wrongs: num(x, [a * x + b - a, (a * x) / a + b, x + b, x + a], String), ar: `حلّ المعادلة: ${eq}`, en: `Solve the equation: ${eq}` };
});

const properties = topic('distribute', /^الخصائص الجبريه$/, [6, 6], ({ rng, diff }) => {
  const a = int(rng, 2, 9), b = int(rng, 2, span(diff) > 6 ? 5 : 3), c = int(rng, 1, 9);
  const minus = rng() < 0.4;
  const text = `${a}(${b === 1 ? '' : b}x ${minus ? '−' : '+'} ${c})`;
  const ans = [(minus ? -c : c) * a, a * b];
  return {
    eq: text, answer: polyStr(ans),
    wrongs: polyOpts(ans, [[(minus ? -c : c), a * b], [(minus ? c : -c) * a, a * b], [(minus ? -c : c) * a, b + a]]),
    ar: `استعمل خاصية التوزيع لتبسيط: ${text}`, en: `Use the distributive property to simplify: ${text}`,
  };
});

const sequences = topic('seq_basic', /^المتتاليات$/, [6, 7], ({ rng, diff, grade }) => {
  const geometric = grade >= 7 && tier(diff) >= 1 && rng() < 0.4;
  if (geometric) {
    const a = int(rng, 1, 5), r = int(rng, 2, 3);
    const t = [a, a * r, a * r ** 2, a * r ** 3];
    const next = a * r ** 4;
    return { eq: t.join(', '), answer: String(next), wrongs: num(next, [t[3]! + (t[3]! - t[2]!), t[3]! + r, t[3]! * (r + 1), next + a], String), ar: `ما الحد التالي في المتتالية: ${t.join('، ')}، …؟`, en: `What is the next term in the sequence ${t.join(', ')}, …?` };
  }
  const a = int(rng, -3, 12), d = nz(rng, span(diff) > 6 ? 9 : 5);
  const t = [a, a + d, a + 2 * d, a + 3 * d];
  if (grade >= 7 && tier(diff) === 2) {
    const n = int(rng, 8, 15);
    const ans = a + (n - 1) * d;
    return { eq: t.map(signed).join(', '), answer: signed(ans), wrongs: num(ans, [a + n * d, a + (n - 2) * d, n * d, ans + d]), ar: `ما الحد رقم ${n} في المتتالية الحسابية: ${t.map(signed).join('، ')}، …؟`, en: `What is term number ${n} of the arithmetic sequence ${t.map(signed).join(', ')}, …?` };
  }
  const next = a + 4 * d;
  return { eq: t.map(signed).join(', '), answer: signed(next), wrongs: num(next, [next + d, next - d, t[3]! + 1, next + 2 * d]), ar: `ما الحد التالي في المتتالية: ${t.map(signed).join('، ')}، …؟`, en: `What is the next term in the sequence ${t.map(signed).join(', ')}, …?` };
});

const terms = topic('alg_terms', /^الحدود والمقادير الجبريه$/, [7, 7], ({ rng, diff }) => {
  const a = nz(rng, 9), b = nz(rng, 9), c = nz(rng, 9);
  const co = [c, b, a];
  const expr = polyStr(co);
  const k = int(rng, 0, 2);
  if (k === 0) {
    const p = pick(rng, [1, 2]);
    return { eq: expr, answer: signed(co[p]!), wrongs: num(co[p]!, [-co[p]!, co[p === 1 ? 2 : 1]!, co[0]!]), ar: `ما معامل الحد ${p === 1 ? 'x' : 'x²'} في المقدار ${expr}؟`, en: `What is the coefficient of ${p === 1 ? 'x' : 'x²'} in ${expr}?` };
  }
  if (k === 1) return { eq: expr, answer: '3', wrongs: ['2', '4', '1'], ar: `كم حدًا في المقدار ${expr}؟`, en: `How many terms are in ${expr}?` };
  const x = int(rng, -3, span(diff) > 6 ? 5 : 3);
  const v = a * x * x + b * x + c;
  return { eq: expr, answer: signed(v), wrongs: num(v, [a * x + b * x + c, a * 2 * x + b * x + c, -v, v + a]), ar: `أوجد قيمة المقدار ${expr} عندما x = ${signed(x)}.`, en: `Find the value of ${expr} when x = ${signed(x)}.` };
});

const polyAddSub = topic('poly_addsub', /^جمع المقادير الجبريه وطرحها$/, [7, 7], ({ rng, diff }) => {
  const sub = rng() < 0.5;
  const deg = tier(diff) === 0 ? 1 : 2;
  const mk = () => Array.from({ length: deg + 1 }, () => int(rng, -9, 9));
  let A = mk(), B = mk();
  if (!A[deg] || !B[deg]) { A[deg] = int(rng, 1, 9); B[deg] = int(rng, 1, 9); }
  const as = polyStr(A), bs = polyStr(B);
  const ans = add(A, B, sub ? -1 : 1);
  if (trim(ans).length === 0) return polyAddSub.make({ rng, diff, grade: 7 });
  const slip = sub ? A.map((x, i) => (i === 0 ? x - B[i]! : x + B[i]!)) : add(A, B, -1);
  return {
    eq: `(${as}) ${sub ? '−' : '+'} (${bs})`, answer: polyStr(ans),
    wrongs: polyOpts(ans, [slip, sub ? add(A, B, 1) : add(A, B, -1), ans.map(x => -x)]),
    ar: `بسّط: (${as}) ${sub ? '−' : '+'} (${bs})`, en: `Simplify: (${as}) ${sub ? '−' : '+'} (${bs})`,
  };
});

const polyMul = topic('poly_mul', /^ضرب المقادير الجبريه$/, [7, 7], ({ rng, diff }) => {
  const k = tier(diff) === 0 ? 0 : tier(diff) === 1 ? pick(rng, [0, 1]) : pick(rng, [1, 2]);
  if (k === 0) {
    const a = int(rng, 2, 9), b = int(rng, 2, 9), m = int(rng, 1, 4), n = int(rng, 1, 4);
    const xp = (e: number) => (e === 1 ? 'x' : `x${sup(e)}`);
    const ans = `${a * b}${xp(m + n)}`;
    const stem = `${a}${xp(m)} × ${b}${xp(n)}`;
    return { eq: stem, answer: ans, wrongs: wrongsFrom(ans, [`${a + b}${xp(m + n)}`, `${a * b}${xp(m * n)}`, `${a * b}${xp(m + n + 1)}`], j => `${a * b + Math.abs(j)}${xp(m + n)}`), ar: `أوجد ناتج ${stem}`, en: `Find ${stem}` };
  }
  if (k === 1) {
    const a = int(rng, 2, 6), b = nz(rng, 7), c = nz(rng, 7);
    const inner = [c, b];
    const ans = mul([0, a], inner);
    return { eq: `${a}x(${polyStr(inner)})`, answer: polyStr(ans), wrongs: polyOpts(ans, [[0, a * c, a * b], [a * c, a * b], [0, a * b, c]]), ar: `أوجد ناتج ${a}x(${polyStr(inner)})`, en: `Find ${a}x(${polyStr(inner)})` };
  }
  const p = nz(rng, 6), q = nz(rng, 6), m = pick(rng, [1, 1, 2, 3]), n = pick(rng, [1, 2]);
  const ans = mul([p, m], [q, n]);
  return {
    eq: `${fac(m, p)}${fac(n, q)}`, answer: polyStr(ans),
    wrongs: polyOpts(ans, [[p * q, m * q + n * p + 1, m * n], [p * q, m * n, m * n], [p * q, m + n, m * n], [p * q, m * q - n * p, m * n]]),
    ar: `أوجد ناتج ${fac(m, p)}${fac(n, q)}`, en: `Find ${fac(m, p)}${fac(n, q)}`,
  };
});

const special = topic('poly_special', /^حالات خاصه من ضرب المقادير الجبريه$/, [7, 7], ({ rng, diff }) => {
  const a = int(rng, 1, span(diff) > 6 ? 9 : 6), m = tier(diff) === 2 ? int(rng, 1, 3) : 1;
  const k = pick(rng, [0, 1, 2]);
  if (k === 2) {
    const ans = [-(a * a), 0, m * m];
    return { eq: `${fac(m, a)}${fac(m, -a)}`, answer: polyStr(ans), wrongs: polyOpts(ans, [[-(a * a), -2 * a * m, m * m], [a * a, 0, m * m], [-(a * a), 0, m]]), ar: `أوجد ناتج ${fac(m, a)}${fac(m, -a)}`, en: `Find ${fac(m, a)}${fac(m, -a)}` };
  }
  const s = k === 0 ? 1 : -1;
  const ans = [a * a, 2 * s * a * m, m * m];
  return {
    eq: `${fac(m, s * a)}${sup(2)}`, answer: polyStr(ans),
    wrongs: polyOpts(ans, [[a * a, 0, m * m], [a * a, s * a * m, m * m], [a * a, -2 * s * a * m, m * m], [-(a * a), 2 * s * a * m, m * m]]),
    ar: `أوجد ناتج ${fac(m, s * a)}${sup(2)}`, en: `Find ${fac(m, s * a)}${sup(2)}`,
  };
});

const solveEq = topic('solve_eq', /^حل المعادلات$/, [7, 7], ({ rng, diff }) => {
  const x = int(rng, -8, 9);
  const t = tier(diff);
  let eq: string;
  let wr: number[];
  if (t === 0) {
    const a = int(rng, 2, 7), b = nz(rng, 12);
    eq = `${polyStr([b, a])} = ${signed(a * x + b)}`;
    wr = [(a * x + b + b) / a, x + b, a * x, x - 1];
  } else if (t === 1) {
    const a = int(rng, 2, 6), b = int(rng, 1, 9);
    eq = `${a}(x ${b < 0 ? '−' : '+'} ${Math.abs(b)}) = ${signed(a * (x + b))}`;
    wr = [x - b + b * (a - 1), x + b, x - b, a * x + b];
  } else {
    // ax + b = cx + d, with d chosen so that x is the solution
    const a = int(rng, 3, 8), c = int(rng, 1, a - 1), b = nz(rng, 12);
    const d = b + (a - c) * x;
    eq = `${polyStr([b, a])} = ${polyStr([d, c])}`;
    wr = [x + 1, x - 1, -x, (d - b) / (a + c)];
  }
  return { eq, answer: signed(x), wrongs: num(x, wr.filter(Number.isInteger).concat([x + 1, -x])), ar: `حلّ المعادلة: ${eq}`, en: `Solve the equation: ${eq}` };
});

// ─── Grade 8: factoring ─────────────────────────────────────────────────────

const factorGcf = topic('factor_gcf', /^التحليل باخراج العامل المشترك الاكبر$/, [8, 8], ({ rng, diff }) => {
  const g = int(rng, 2, 7), u = int(rng, 1, 5), v = int(rng, 1, 5);
  // g must be the GREATEST common factor: u and v share nothing, and differ so the swap is a different answer
  if (u === v || gcd(u, v) !== 1) return factorGcf.make({ rng, diff, grade: 8 });
  const withX = tier(diff) >= 1 && rng() < 0.7;
  const [a, b] = [g * u, g * v];
  if (withX) {
    const ans = `${g}x(${polyStr([v, u])})`;
    const co = [0, g * v, g * u];
    return {
      eq: polyStr(co), answer: ans,
      wrongs: wrongsFrom(ans, [`${g}(${polyStr([0, v, u])})`, `x(${polyStr([g * v, g * u])})`, `${g}x(${polyStr([u, v])})`], k => `${g + Math.abs(k)}x(${polyStr([v, u])})`),
      ar: `حلّل بإخراج العامل المشترك الأكبر: ${polyStr(co)}`, en: `Factor out the greatest common factor: ${polyStr(co)}`,
    };
  }
  const ans = `${g}(${polyStr([v, u])})`;
  return {
    eq: polyStr([b, a]), answer: ans,
    wrongs: wrongsFrom(ans, [`${g}(${polyStr([u, v])})`, `${g + 1}(${polyStr([v, u])})`], k => `${g}(${polyStr([v + Math.abs(k), u])})`),
    ar: `حلّل بإخراج العامل المشترك الأكبر: ${polyStr([b, a])}`, en: `Factor out the greatest common factor: ${polyStr([b, a])}`,
  };
});

/** Factors in a canonical order — by x-coefficient, then constant — so one product has one spelling. */
const factorPair = (f1: [number, number], f2: [number, number]) => {
  const [a, b] = [f1, f2].sort((s, t) => s[0] - t[0] || s[1] - t[1]);
  return `${fac(a![0], a![1])}${fac(b![0], b![1])}`;
};

const factorMonic = topic('factor_monic', /ثلاثيات الحدود x.\+bx\+c/, [8, 8], ({ rng, diff }) => {
  const m = span(diff) > 6 ? 9 : 6;
  let p = nz(rng, m), q = nz(rng, m);
  if (p === q) q = -q;
  if (p + q === 0) return factorMonic.make({ rng, diff, grade: 8 }); // no middle term: that is a difference of squares
  const co = [p * q, p + q, 1];
  const ans = factorPair([1, p], [1, q]);
  const key = (s: number, pr: number) => `${s},${pr}`;
  const seen = new Set([key(p + q, p * q)]);
  const wr: string[] = [];
  for (const [a, b] of [[-p, -q], [p, -q], [-p, q], [p + 1, q], [p, q + 1], [p * -1, q + 2]] as Array<[number, number]>) {
    if (wr.length === 3 || a === b || a === 0 || b === 0 || seen.has(key(a + b, a * b))) continue;
    seen.add(key(a + b, a * b));
    wr.push(factorPair([1, a], [1, b]));
  }
  for (let k = 1; wr.length < 3; k++) { const a = p + k, b = q; if (a !== b && a !== 0 && !seen.has(key(a + b, a * b))) { seen.add(key(a + b, a * b)); wr.push(factorPair([1, a], [1, b])); } }
  return { eq: polyStr(co), answer: ans, wrongs: wr, ar: `حلّل: ${polyStr(co)}`, en: `Factor: ${polyStr(co)}` };
});

const factorGeneral = topic('factor_general', /ثلاثيات الحدود ax.\+bx\+c/, [8, 8], ({ rng, diff }) => {
  for (let attempt = 0; attempt < 200; attempt++) {
    const m = pick(rng, [1, 2, 3]), n = pick(rng, [2, 3, 4]);
    const p = nz(rng, span(diff) > 6 ? 7 : 5), q = nz(rng, span(diff) > 6 ? 7 : 5);
    if (gcd(m, Math.abs(p)) !== 1 || gcd(n, Math.abs(q)) !== 1) continue;
    const co = mul([p, m], [q, n]);
    if (co.some(c => c === 0) || gcd(gcd(Math.abs(co[0]!), Math.abs(co[1]!)), co[2]!) !== 1) continue;
    const ans = factorPair([m, p], [n, q]);
    const seen = new Set([ans]);
    const wr: string[] = [];
    const take = (a: [number, number], b: [number, number]) => {
      const e = add(mul([a[1], a[0]], [b[1], b[0]]), []);
      if (e.join() === co.join()) return;
      const s = factorPair(a, b);
      if (!seen.has(s)) { seen.add(s); wr.push(s); }
    };
    take([m, q], [n, p]); take([m, -p], [n, -q]); take([m, p], [n, -q]); take([m, -p], [n, q]); take([n, p], [m, q]);
    for (let k = 1; wr.length < 3 && k < 9; k++) take([m, p + k], [n, q]);
    if (wr.length < 3) continue;
    return { eq: polyStr(co), answer: ans, wrongs: wr.slice(0, 3), ar: `حلّل: ${polyStr(co)}`, en: `Factor: ${polyStr(co)}` };
  }
  return factorMonic.make({ rng, diff, grade: 8 });
});

const factorSpecial = topic('factor_special', /^حالات خاصه من التحليل$/, [8, 8], ({ rng, diff }) => {
  const a = int(rng, 1, 9), m = tier(diff) === 2 ? int(rng, 1, 4) : 1;
  const k = pick(rng, [0, 1, 2]);
  if (k === 0) {
    const co = [-(a * a), 0, m * m];
    const ans = `${fac(m, -a)}${fac(m, a)}`;
    return { eq: polyStr(co), answer: ans, wrongs: [`${fac(m, -a)}${sup(2)}`, `${fac(m, a)}${sup(2)}`, `${fac(m, -a - 1)}${fac(m, a + 1)}`], ar: `حلّل: ${polyStr(co)}`, en: `Factor: ${polyStr(co)}` };
  }
  const s = k === 1 ? 1 : -1;
  const co = [a * a, 2 * s * a * m, m * m];
  const ans = `${fac(m, s * a)}${sup(2)}`;
  return { eq: polyStr(co), answer: ans, wrongs: [`${fac(m, -s * a)}${sup(2)}`, `${fac(m, s * a)}${fac(m, -s * a)}`, `${fac(m, s * (a + 1))}${sup(2)}`], ar: `حلّل: ${polyStr(co)}`, en: `Factor: ${polyStr(co)}` };
});

// ─── Grades 8–9: inequalities ───────────────────────────────────────────────

const SYM = ['<', '>', '≤', '≥'] as const;
const flip = (s: string) => ({ '<': '>', '>': '<', '≤': '≥', '≥': '≤' }[s]!);
const ineqWrongs = (s: string, bound: string, v = 'x') => {
  const others = SYM.filter(t => t !== s);
  return [`${v} ${others[0]} ${bound}`, `${v} ${others[1]} ${bound}`, `${v} ${others[2]} ${bound}`];
};

const writeIneq = topic('ineq_write', /^كتابه المتباينات وتمثيلها$/, [8, 8], ({ rng }) => {
  const n = int(rng, -5, 20);
  const [s, ar, en] = pick(rng, [
    ['>', 'أكبر من', 'greater than'], ['<', 'أقل من', 'less than'], ['≥', 'لا يقل عن', 'at least'], ['≤', 'لا يزيد على', 'at most'],
  ] as const);
  const ans = `x ${s} ${signed(n)}`;
  return { eq: ans, answer: ans, wrongs: ineqWrongs(s, signed(n)), ar: `اكتب متباينة تعبّر عن: العدد x ${ar} ${signed(n)}.`, en: `Write an inequality for: the number x is ${en} ${signed(n)}.` };
});

const ineqAdd = topic('ineq_add', /^حل المتباينات بالجمع والطرح$/, [8, 8], ({ rng, diff }) => {
  const x0 = int(rng, -6, 12), a = int(rng, 1, span(diff) + 3);
  const s = pick(rng, SYM);
  const plus = rng() < 0.5;
  const eq = `x ${plus ? '+' : '−'} ${a} ${s} ${signed(plus ? x0 + a : x0 - a)}`;
  const ans = `x ${s} ${signed(x0)}`;
  const wrongBound = plus ? x0 + 2 * a : x0 - 2 * a;
  return {
    eq, answer: ans,
    wrongs: wrongsFrom(ans, [`x ${s} ${signed(wrongBound)}`, `x ${flip(s)} ${signed(x0)}`, `x ${SYM.find(t => t !== s && t !== flip(s))!} ${signed(x0)}`], k => `x ${s} ${signed(x0 + Math.abs(k) + 1)}`),
    ar: `حلّ المتباينة: ${eq}`, en: `Solve the inequality: ${eq}`,
  };
});

const ineqMul = topic('ineq_mul', /^حل المتباينات بالضرب والقسمه$/, [8, 8], ({ rng, diff }) => {
  const x0 = int(rng, -6, 9), a = nz(rng, span(diff) > 6 ? 7 : 5);
  if (Math.abs(a) === 1) return ineqMul.make({ rng, diff, grade: 8 });
  const s = pick(rng, SYM);
  const div = rng() < 0.3;
  const eq = div ? `x ÷ ${signed(a)} ${s} ${signed(x0)}` : `${signed(a)}x ${s} ${signed(a * x0)}`;
  const bound = div ? a * x0 : x0;
  const rs = a < 0 ? flip(s) : s;
  const ans = `x ${rs} ${signed(bound)}`;
  return {
    eq, answer: ans,
    wrongs: wrongsFrom(ans, [`x ${a < 0 ? s : flip(s)} ${signed(bound)}`, `x ${rs} ${signed(-bound)}`, `x ${a < 0 ? s : flip(s)} ${signed(-bound)}`], k => `x ${rs} ${signed(bound + Math.abs(k))}`),
    ar: `حلّ المتباينة: ${eq}`, en: `Solve the inequality: ${eq}`,
  };
});

const ineqMulti = topic('ineq_multi', /^حل المتباينات متعدده الخطوات$/, [8, 8], ({ rng, diff }) => {
  const x0 = int(rng, -5, 9), a = nz(rng, 6), b = nz(rng, 9);
  if (Math.abs(a) === 1) return ineqMulti.make({ rng, diff, grade: 8 });
  const s = pick(rng, SYM);
  const eq = `${polyStr([b, a])} ${s} ${signed(a * x0 + b)}`;
  const rs = a < 0 ? flip(s) : s;
  const ans = `x ${rs} ${signed(x0)}`;
  return {
    eq, answer: ans,
    wrongs: wrongsFrom(ans, [`x ${a < 0 ? s : flip(s)} ${signed(x0)}`, `x ${rs} ${signed(a * x0)}`, `x ${rs} ${signed(x0 + b)}`], k => `x ${rs} ${signed(x0 + Math.abs(k))}`),
    ar: `حلّ المتباينة: ${eq}`, en: `Solve the inequality: ${eq}`,
  };
});

const compound = topic('ineq_compound', /^حل المتباينات المركبه$/, [9, 9], ({ rng, diff }) => {
  const lo = int(rng, -6, 4), hi = lo + int(rng, 2, 9), a = int(rng, 2, 4), b = nz(rng, 7);
  if (rng() < 0.6) {
    const [s1, s2] = pick(rng, [['<', '<'], ['<', '≤'], ['≤', '<'], ['≤', '≤']] as const);
    const eq = `${signed(a * lo + b)} ${s1} ${polyStr([b, a])} ${s2} ${signed(a * hi + b)}`;
    const ans = `${signed(lo)} ${s1} x ${s2} ${signed(hi)}`;
    const open = (s: string) => (s === '<' ? '≤' : '<');
    return { eq, answer: ans, wrongs: [`${signed(lo)} ${open(s1)} x ${s2} ${signed(hi)}`, `${signed(lo)} ${s1} x ${open(s2)} ${signed(hi)}`, `${signed(a * lo)} ${s1} x ${s2} ${signed(a * hi)}`], ar: `حلّ المتباينة المركبة: ${eq}`, en: `Solve the compound inequality: ${eq}` };
  }
  const [c1, c2] = [int(rng, -5, 2), int(rng, 3, 9)];
  const eq = `x + ${a} < ${signed(c1 + a)} أو ${a}x ≥ ${a * c2}`;
  const ans = `x < ${signed(c1)} أو x ≥ ${c2}`;
  return { eq, answer: ans, wrongs: [`x > ${signed(c1)} أو x ≤ ${c2}`, `x < ${signed(c1)} و x ≥ ${c2}`, `x < ${signed(c1 + a)} أو x ≥ ${a * c2}`], ar: `حلّ المتباينة المركبة: ${eq}`, en: `Solve the compound inequality: ${eq.replace('أو', 'or')}` };
});

const intervals = topic('intervals', /^المجموعات والفترات$/, [9, 9], ({ rng }) => {
  const a = int(rng, -6, 5), b = a + int(rng, 2, 8);
  const k = pick(rng, [0, 1, 2, 3]);
  if (k === 0) { const s = pick(rng, ['>', '≥']); const ans = `${s === '>' ? '(' : '['}${signed(a)} ، ∞)`; return { eq: `x ${s} ${signed(a)}`, answer: ans, wrongs: [`${s === '>' ? '[' : '('}${signed(a)} ، ∞)`, `(−∞ ، ${signed(a)}${s === '>' ? ')' : ']'}`, `(−∞ ، ${signed(a)}${s === '>' ? ']' : ')'}`], ar: `اكتب المتباينة x ${s} ${signed(a)} على صورة فترة.`, en: `Write x ${s} ${signed(a)} in interval notation.` }; }
  if (k === 1) { const s = pick(rng, ['<', '≤']); const ans = `(−∞ ، ${signed(a)}${s === '<' ? ')' : ']'}`; return { eq: `x ${s} ${signed(a)}`, answer: ans, wrongs: [`(−∞ ، ${signed(a)}${s === '<' ? ']' : ')'}`, `${s === '<' ? '(' : '['}${signed(a)} ، ∞)`, `${s === '<' ? '[' : '('}${signed(a)} ، ∞)`], ar: `اكتب المتباينة x ${s} ${signed(a)} على صورة فترة.`, en: `Write x ${s} ${signed(a)} in interval notation.` }; }
  const [s1, s2] = pick(rng, [['<', '<'], ['<', '≤'], ['≤', '<'], ['≤', '≤']] as const);
  const br = (s: string, side: 'l' | 'r') => (side === 'l' ? (s === '<' ? '(' : '[') : (s === '<' ? ')' : ']'));
  const ans = `${br(s1, 'l')}${signed(a)} ، ${signed(b)}${br(s2, 'r')}`;
  const alt = (s: string, side: 'l' | 'r') => br(s === '<' ? '≤' : '<', side);
  const wrongs = [`${alt(s1, 'l')}${signed(a)} ، ${signed(b)}${br(s2, 'r')}`, `${br(s1, 'l')}${signed(a)} ، ${signed(b)}${alt(s2, 'r')}`, `${alt(s1, 'l')}${signed(a)} ، ${signed(b)}${alt(s2, 'r')}`];
  return { eq: `${signed(a)} ${s1} x ${s2} ${signed(b)}`, answer: ans, wrongs, ar: `اكتب المتباينة ${signed(a)} ${s1} x ${s2} ${signed(b)} على صورة فترة.`, en: `Write ${signed(a)} ${s1} x ${s2} ${signed(b)} in interval notation.` };
});

// ─── Grade 8: systems and lines ─────────────────────────────────────────────

const sysWrongs = (x: number, y: number) => {
  const out: string[] = [];
  const take = (a: number, b: number) => { const s = pair(a, b); if (s !== pair(x, y) && !out.includes(s)) out.push(s); };
  take(y, x); take(x, -y); take(-x, y); take(x + 1, y); take(x, y + 1); take(x + 2, y - 1);
  return out.slice(0, 3);
};

const systemTopic = (id: string, match: RegExp, mode: 'graph' | 'sub' | 'elim') => topic(id, match, [8, 8], ({ rng, diff }) => {
  for (let attempt = 0; attempt < 100; attempt++) {
    const x = int(rng, -4, 6), y = int(rng, -4, 6);
    const yEq = (m: number) => `y = ${polyStr([y - m * x, m])}`;
    let e1: string, e2: string;
    if (mode === 'elim') {
      const a = int(rng, 1, 4), b = nz(rng, 4), c = int(rng, 1, 4) * (rng() < 0.5 ? 1 : -1), d = nz(rng, 4);
      if (a * d - b * c === 0) continue;
      e1 = lineEq(a, b, a * x + b * y); e2 = lineEq(c, d, c * x + d * y);
    } else {
      const m1 = nz(rng, 3);
      e1 = yEq(m1);
      if (mode === 'sub' && tier(diff) > 0) {
        const a2 = int(rng, 1, 3);
        if (m1 === -a2) continue; // parallel
        e2 = lineEq(a2, 1, a2 * x + y);
      } else {
        const m2 = nz(rng, 3);
        if (m1 === m2) continue;
        e2 = yEq(m2);
      }
    }
    const how = mode === 'graph' ? 'بيانيًا' : mode === 'sub' ? 'بالتعويض' : 'بالحذف';
    const howEn = mode === 'graph' ? 'by graphing' : mode === 'sub' ? 'by substitution' : 'by elimination';
    return { eq: `${e1} ، ${e2}`, answer: pair(x, y), wrongs: sysWrongs(x, y), ar: `حلّ النظام الآتي ${how}:\n${e1}\n${e2}`, en: `Solve the system ${howEn}:\n${e1}\n${e2}` };
  }
  throw new Error('system generator found no draw');
});

const standardForm = topic('line_standard', /^المعادله الخطيه بالصوره القياسيه$/, [8, 8], ({ rng }) => {
  if (rng() < 0.4) {
    // y = mx + b  →  mx − y = −b, with the x coefficient positive
    const m = nz(rng, 5), b = nz(rng, 9);
    const [A, B, C] = m > 0 ? [m, -1, -b] : [-m, 1, b];
    const ans = lineEq(A, B, C);
    const wr = [lineEq(A, -B, C), lineEq(A, B, -C), lineEq(-A, B, C)];
    return { eq: `y = ${polyStr([b, m])}`, answer: ans, wrongs: wr, ar: `اكتب المعادلة y = ${polyStr([b, m])} بالصورة القياسية Ax + By = C.`, en: `Write y = ${polyStr([b, m])} in standard form Ax + By = C.` };
  }
  // Ax + By = C with both intercepts whole
  const A = int(rng, 1, 5), B = pick(rng, [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]);
  const C = lcm(A, Math.abs(B)) * int(rng, 1, 4) * (rng() < 0.5 ? 1 : -1);
  const eq = lineEq(A, B, C);
  const xi = C / A, yi = C / B;
  if (rng() < 0.5) return { eq, answer: signed(xi), wrongs: num(xi, [-xi, yi, C, xi + 1].filter(v => v !== xi)), ar: `ما المقطع السيني للمستقيم ${eq}؟`, en: `What is the x-intercept of ${eq}?` };
  return { eq, answer: signed(yi), wrongs: num(yi, [-yi, xi, C, yi + 1].filter(v => v !== yi)), ar: `ما المقطع الصادي للمستقيم ${eq}؟`, en: `What is the y-intercept of ${eq}?` };
});

const slope = topic('line_slope', /^ميل المستقيم$/, [8, 8], ({ rng, diff }) => {
  for (;;) {
    const x1 = int(rng, -5, 5), y1 = int(rng, -5, 5), dx = nz(rng, span(diff) > 6 ? 6 : 4), dy = int(rng, -6, 6);
    if (dy === 0 && tier(diff) < 2) continue;
    const x2 = x1 + dx, y2 = y1 + dy;
    const ans = sfrac(dy, dx);
    const wr = [sfrac(dx, dy === 0 ? 1 : dy), sfrac(-dy, dx), sfrac(dx, dy === 0 ? 2 : -dy), sfrac(dy + 1, dx)].filter(w => w !== ans);
    return { eq: `${pair(x1, y1)} ، ${pair(x2, y2)}`, answer: ans, wrongs: wrongsFrom(ans, wr, k => sfrac(dy + Math.abs(k) + 1, dx)), ar: `أوجد ميل المستقيم المار بالنقطتين ${pair(x1, y1)} و ${pair(x2, y2)}.`, en: `Find the slope of the line through ${pair(x1, y1)} and ${pair(x2, y2)}.` };
  }
});

const slopeIntercept = topic('line_slope_int', /^معادله المستقيم بصيغه الميل والمقطع$/, [8, 8], ({ rng, diff }) => {
  const m = nz(rng, 5), b = nz(rng, 9);
  const ans = `y = ${polyStr([b, m])}`;
  if (tier(diff) < 2) {
    return { eq: ans, answer: ans, wrongs: wrongsFrom(ans, [`y = ${polyStr([m, b])}`, `y = ${polyStr([-b, m])}`, `y = ${polyStr([b, -m])}`], k => `y = ${polyStr([b + Math.abs(k), m])}`), ar: `اكتب معادلة المستقيم الذي ميله ${signed(m)} ويقطع المحور y عند ${signed(b)}.`, en: `Write the equation of the line with slope ${signed(m)} and y-intercept ${signed(b)}.` };
  }
  const x1 = int(rng, -3, 3), y1 = m * x1 + b, x2 = x1 + int(rng, 1, 3), y2 = m * x2 + b;
  return { eq: ans, answer: ans, wrongs: wrongsFrom(ans, [`y = ${polyStr([m, b])}`, `y = ${polyStr([y1, m])}`, `y = ${polyStr([b, -m])}`], k => `y = ${polyStr([b + Math.abs(k), m])}`), ar: `اكتب معادلة المستقيم المار بالنقطتين ${pair(x1, y1)} و ${pair(x2, y2)} بصيغة الميل والمقطع.`, en: `Write the equation of the line through ${pair(x1, y1)} and ${pair(x2, y2)} in slope-intercept form.` };
});

const pointSlope = topic('line_point_slope', /^معادله المستقيم بصيغه الميل ونقطه$/, [8, 8], ({ rng }) => {
  const m = nz(rng, 6), x1 = nz(rng, 7), y1 = nz(rng, 7);
  // with m = −1 the swapped-coordinates distractor is the same line
  if (m === -1) return pointSlope.make({ rng, diff: 'easy', grade: 8 });
  const side = (v: string, k: number) => `${v} ${k < 0 ? '+' : '−'} ${Math.abs(k)}`;
  const mm = m < 0 ? `(${signed(m)})` : String(m);
  const ans = `${side('y', y1)} = ${mm}(${side('x', x1)})`;
  return {
    eq: ans, answer: ans,
    wrongs: wrongsFrom(ans, [`${side('y', -y1)} = ${mm}(${side('x', x1)})`, `${side('y', y1)} = ${mm}(${side('x', -x1)})`, `${side('y', x1)} = ${mm}(${side('x', y1)})`], k => `${side('y', y1)} = ${mm}(${side('x', x1 + Math.abs(k))})`),
    ar: `اكتب معادلة المستقيم الذي ميله ${signed(m)} ويمر بالنقطة ${pair(x1, y1)} بصيغة الميل ونقطة.`, en: `Write the equation of the line with slope ${signed(m)} through ${pair(x1, y1)} in point-slope form.`,
  };
});

const parallel = topic('line_par_perp', /^المستقيمات المتوازيه والمتعامده$/, [8, 8], ({ rng, diff }) => {
  const m = nz(rng, 5), c = nz(rng, 8);
  const k = tier(diff) === 0 ? pick(rng, [0, 1]) : pick(rng, [0, 1, 2]);
  if (k === 0) return { eq: `y = ${polyStr([c, m])}`, answer: signed(m), wrongs: num(m, [-m, 1 / m, c, -1 / m].map(x => x).filter(Number.isInteger).concat([m + 1, m - 1])), ar: `ما ميل المستقيم الموازي للمستقيم y = ${polyStr([c, m])}؟`, en: `What is the slope of a line parallel to y = ${polyStr([c, m])}?` };
  if (k === 1) {
    const ans = sfrac(-1, m);
    return { eq: `y = ${polyStr([c, m])}`, answer: ans, wrongs: wrongsFrom(ans, [signed(m), signed(-m), sfrac(1, m)], j => sfrac(-1, m + Math.abs(j) + 1)), ar: `ما ميل المستقيم العمودي على المستقيم y = ${polyStr([c, m])}؟`, en: `What is the slope of a line perpendicular to y = ${polyStr([c, m])}?` };
  }
  const x1 = int(rng, -4, 4), y1 = int(rng, -5, 5), b = y1 - m * x1;
  const ans = `y = ${polyStr([b, m])}`;
  return { eq: ans, answer: ans, wrongs: wrongsFrom(ans, [`y = ${polyStr([y1, m])}`, `y = ${polyStr([y1 + m * x1, m])}`, `y = ${polyStr([b, -m])}`], k => `y = ${polyStr([b + Math.abs(k), m])}`), ar: `اكتب معادلة المستقيم المار بالنقطة ${pair(x1, y1)} والموازي للمستقيم y = ${polyStr([c, m])}.`, en: `Write the equation of the line through ${pair(x1, y1)} parallel to y = ${polyStr([c, m])}.` };
});

// ─── Grade 9: quadratics ────────────────────────────────────────────────────

/** Roots of (mx + p)(nx + q) = 0 as sorted fractions. */
function quadFromRoots(rng: Rng, diff: DiffTierLike, general: boolean) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const m = general && tier(diff) === 2 ? pick(rng, [1, 2, 3]) : 1;
    const n = general && tier(diff) === 2 ? pick(rng, [1, 2, 3]) : 1;
    const p = nz(rng, span(diff) > 6 ? 7 : 5), q = nz(rng, span(diff) > 6 ? 7 : 5);
    if (gcd(m, Math.abs(p)) !== 1 || gcd(n, Math.abs(q)) !== 1) continue;
    if (-p / m === -q / n) continue;
    const co = mul([p, m], [q, n]);
    const roots = [[-p, m], [-q, n]].sort((a, b) => a[0]! / a[1]! - b[0]! / b[1]!);
    return { m, n, p, q, co, roots, rootStr: roots.map(([a, b]) => sfrac(a!, b!)).join(' ، ') };
  }
  throw new Error('quadratic generator found no draw');
}

const rootWrongs = (m: number, n: number, p: number, q: number) => {
  const f = (a: number, b: number, c: number, d: number) => [[a, b], [c, d]].sort((s, t) => s[0]! / s[1]! - t[0]! / t[1]!).map(([x, y]) => sfrac(x!, y!)).join(' ، ');
  return [f(p, m, q, n), f(-p, m, q, n), f(p, m, -q, n), f(-p, n, -q, m), f(-p, m, -q + n, n)];
};

const quadSolve = (id: string, match: RegExp, how: [string, string]) => topic(id, match, [9, 9], ({ rng, diff }) => {
  const { m, n, p, q, co, rootStr } = quadFromRoots(rng, diff, true);
  const eq = `${polyStr(co)} = 0`;
  const wr = rootWrongs(m, n, p, q).filter((w, i, s) => w !== rootStr && s.indexOf(w) === i);
  return { eq, answer: rootStr, wrongs: wrongsFrom(rootStr, wr, k => `${p + Math.abs(k)} ، ${q}`), ar: `حلّ المعادلة ${eq} ${how[0]}.`, en: `Solve ${eq} ${how[1]}.` };
});

const quadComplete = topic('quad_complete', /^حل المعادلات التربيعيه باكمال المربع$/, [9, 9], ({ rng, diff }) => {
  const h = int(rng, 1, span(diff) > 6 ? 7 : 5), b = 2 * h;
  const k = pick(rng, [0, 1, 2]);
  if (k === 0) return { eq: `x² + ${b}x`, answer: String(h * h), wrongs: num(h * h, [h, b, b * b, 2 * h * h], String), ar: `ما العدد الذي يجب إضافته إلى x² + ${b}x لتصبح مربعًا كاملًا؟`, en: `What number must be added to x² + ${b}x to make a perfect square?` };
  const r = int(rng, 1, 8); // (x + h)² = r²  →  roots −h ± r
  const eq = `${polyStr([h * h - r * r, b, 1])} = 0`;
  if (k === 1) {
    const ans = `(x + ${h})² = ${r * r}`;
    return { eq, answer: ans, wrongs: [`(x + ${h})² = ${signed(r * r - h * h)}`, `(x + ${b})² = ${r * r}`, `(x − ${h})² = ${r * r}`], ar: `اكتب المعادلة ${eq} بالصورة (x + h)² = k بإكمال المربع.`, en: `Rewrite ${eq} as (x + h)² = k by completing the square.` };
  }
  const roots = [-h - r, -h + r].sort((p, q) => p - q);
  const ans = roots.map(signed).join(' ، ');
  return { eq, answer: ans, wrongs: wrongsFrom(ans, [`${signed(h - r)} ، ${signed(h + r)}`, `${signed(-h - r)} ، ${signed(r)}`, `${signed(-h)} ، ${signed(r)}`], j => `${signed(roots[0]! + Math.abs(j))} ، ${signed(roots[1]!)}`), ar: `حلّ المعادلة ${eq} بإكمال المربع.`, en: `Solve ${eq} by completing the square.` };
});

const quadFormula = topic('quad_formula', /^حل المعادلات التربيعيه باستعمال القانون العام$/, [9, 9], ({ rng, diff }) => {
  if (rng() < 0.45) {
    const a = int(rng, 1, 3), b = int(rng, -8, 8), c = nz(rng, 6);
    const d = b * b - 4 * a * c;
    return { eq: `${polyStr([c, b, a])} = 0`, answer: signed(d), wrongs: num(d, [b * b + 4 * a * c, b * b - 4 * c, -b * b - 4 * a * c, d + 2 * a]), ar: `أوجد قيمة المميز b² − 4ac للمعادلة ${polyStr([c, b, a])} = 0.`, en: `Find the discriminant b² − 4ac of ${polyStr([c, b, a])} = 0.` };
  }
  const { m, n, p, q, co, rootStr } = quadFromRoots(rng, diff, true);
  const eq = `${polyStr(co)} = 0`;
  const wr = rootWrongs(m, n, p, q).filter((w, i, s) => w !== rootStr && s.indexOf(w) === i);
  return { eq, answer: rootStr, wrongs: wrongsFrom(rootStr, wr, k => `${p + Math.abs(k)} ، ${q}`), ar: `حلّ المعادلة ${eq} باستعمال القانون العام.`, en: `Solve ${eq} using the quadratic formula.` };
});

const quadFunction = topic('quad_function', /^الاقتران التربيعي$/, [9, 9], ({ rng, diff }) => {
  const a = pick(rng, [1, 2, -1, -2, 3]), h = int(rng, -5, 6), c = nz(rng, 9), b = -2 * a * h;
  const k = a * h * h + b * h + c;
  const f = `y = ${polyStr([c, b, a])}`;
  const t = pick(rng, [0, 1, 2]);
  if (t === 0) return { eq: f, answer: signed(h), wrongs: num(h, [-h, b, b / 2, h + 1].filter(Number.isInteger).concat([h - 1])), ar: `أوجد الإحداثي السيني لرأس القطع المكافئ ${f}.`, en: `Find the x-coordinate of the vertex of ${f}.` };
  if (t === 1) return { eq: f, answer: signed(k), wrongs: num(k, [c, -k, a * h * h + c, k + a]), ar: `أوجد القيمة ${a > 0 ? 'الصغرى' : 'العظمى'} للاقتران ${f}.`, en: `Find the ${a > 0 ? 'minimum' : 'maximum'} value of ${f}.` };
  return { eq: f, answer: signed(c), wrongs: num(c, [-c, b, a, c + 1].filter(x => x !== c)), ar: `أوجد المقطع y للمنحنى ${f}.`, en: `Find the y-intercept of ${f}.` };
});

const quadVertex = topic('quad_vertex', /التحويلات الهندسيه.*التربيعي/, [9, 9], ({ rng }) => {
  const a = pick(rng, [1, 2, -1, 3]), h = nz(rng, 6), k = nz(rng, 7);
  const f = `y = ${a === 1 ? '' : a === -1 ? '−' : a}(x ${h < 0 ? '+' : '−'} ${Math.abs(h)})² ${k < 0 ? '−' : '+'} ${Math.abs(k)}`;
  const ans = pair(h, k);
  return { eq: f, answer: ans, wrongs: wrongsFrom(ans, [pair(-h, k), pair(k, h), pair(-h, -k)], j => pair(h, k + Math.abs(j))), ar: `ما رأس القطع المكافئ ${f}؟`, en: `What is the vertex of the parabola ${f}?` };
});

const functions = topic('fn_eval', /^الاقترانات$/, [9, 9], ({ rng, diff }) => {
  const x = int(rng, -4, 6), a = nz(rng, 5), b = nz(rng, 9);
  if (tier(diff) === 2 || rng() < 0.4) {
    const v = a * x * x + b;
    return { eq: `f(x) = ${polyStr([b, 0, a])}`, answer: signed(v), wrongs: num(v, [a * x * 2 + b, (a * x) ** 2 + b, -v, v + a]), ar: `إذا كان f(x) = ${polyStr([b, 0, a])} فأوجد f(${signed(x)}).`, en: `If f(x) = ${polyStr([b, 0, a])}, find f(${signed(x)}).` };
  }
  const v = a * x + b;
  return { eq: `f(x) = ${polyStr([b, a])}`, answer: signed(v), wrongs: num(v, [a + x + b, a * (x + b), -v, v + a]), ar: `إذا كان f(x) = ${polyStr([b, a])} فأوجد f(${signed(x)}).`, en: `If f(x) = ${polyStr([b, a])}, find f(${signed(x)}).` };
});

// ─── Grade 9: exponents, radicals, rational expressions ─────────────────────

/** «6x⁵», «x⁻²» → «1/x²»; coefficient 1 hidden, exponent 0 leaves the number. */
function monoStr(c: number, p: number): string {
  if (p === 0) return String(c);
  const base = `x${p === 1 || p === -1 ? '' : sup(Math.abs(p))}`;
  if (p > 0) return `${c === 1 ? '' : c === -1 ? '−' : c}${base}`;
  return `${c}/${base}`;
}

const simplifyExp = topic('exp_simplify', /^تبسيط المقادير الاسيه$/, [9, 9], ({ rng, diff }) => {
  const a = int(rng, 2, 5), b = int(rng, 2, 5), m = int(rng, 2, 5), n = int(rng, 2, 5);
  const k = tier(diff) === 0 ? pick(rng, [0, 2]) : pick(rng, [0, 1, 2, 3]);
  if (k === 0) { const ans = monoStr(a * b, m + n); return { eq: `${a}x${sup(m)} · ${b}x${sup(n)}`, answer: ans, wrongs: wrongsFrom(ans, [monoStr(a + b, m + n), monoStr(a * b, m * n), monoStr(a * b, m + n + 1)], j => monoStr(a * b + Math.abs(j), m + n)), ar: `بسّط: ${a}x${sup(m)} · ${b}x${sup(n)}`, en: `Simplify: ${a}x${sup(m)} · ${b}x${sup(n)}` }; }
  if (k === 1) { const e = int(rng, 2, 3); const ans = monoStr(a ** e, m * e); return { eq: `(${a}x${sup(m)})${sup(e)}`, answer: ans, wrongs: wrongsFrom(ans, [monoStr(a, m * e), monoStr(a * e, m * e), monoStr(a ** e, m + e)], j => monoStr(a ** e + Math.abs(j), m * e)), ar: `بسّط: (${a}x${sup(m)})${sup(e)}`, en: `Simplify: (${a}x${sup(m)})${sup(e)}` }; }
  if (k === 2) {
    const [p, q] = [m + 1, n];
    const ans = monoStr(a, p - q);
    return { eq: `(${a * b}x${sup(p)}) ÷ (${b}x${sup(q)})`, answer: ans, wrongs: wrongsFrom(ans, [monoStr(a, p + q), monoStr(a * b, p - q), monoStr(a, p * q)].filter(w => w !== ans), j => monoStr(a + Math.abs(j), p - q)), ar: `بسّط: (${a * b}x${sup(p)}) ÷ (${b}x${sup(q)})`, en: `Simplify: (${a * b}x${sup(p)}) ÷ (${b}x${sup(q)})` };
  }
  const ans = monoStr(a, -n);
  return { eq: `${a}x${sup(-n)}`, answer: ans, wrongs: wrongsFrom(ans, [`−${a}x${sup(n)}`, monoStr(a, n), `1/${a}x${sup(n)}`], j => monoStr(a + Math.abs(j), -n)), ar: `اكتب ${a}x${sup(-n)} بأسس موجبة.`, en: `Write ${a}x${sup(-n)} with positive exponents.` };
});

const SQFREE = [2, 3, 5, 6, 7, 10];
const radicalOps = topic('radical_ops', /^العمليات علي المقادير الجذريه$/, [9, 9], ({ rng, diff }) => {
  const m = pick(rng, SQFREE), k = int(rng, 2, 6), a = int(rng, 1, 7), b = nz(rng, 7);
  const t = pick(rng, tier(diff) === 0 ? [0, 1] : [0, 1, 2]);
  if (t === 0) return { eq: `√${k * k * m}`, answer: rad(k, m), wrongs: [rad(k * k, m), rad(k, k * m), `${k + m}`], ar: `بسّط: √${k * k * m}`, en: `Simplify: √${k * k * m}` };
  if (t === 1) {
    if (a + b === 0) return radicalOps.make({ rng, diff, grade: 9 });
    const eq = `${rad(a, m)} ${b < 0 ? '−' : '+'} ${rad(Math.abs(b), m)}`;
    const ans = rad(a + b, m);
    return { eq, answer: ans, wrongs: wrongsFrom(ans, [`${signed(a + b)}√${2 * m}`, rad(a * Math.abs(b), m), rad(a - b, m)], k2 => rad(a + b + Math.abs(k2), m)), ar: `أوجد ناتج ${eq}`, en: `Find ${eq}` };
  }
  const c = int(rng, 2, 5), d = int(rng, 2, 5);
  return { eq: `${c}√${m} × ${d}√${m}`, answer: String(c * d * m), wrongs: num(c * d * m, [c * d, c * d * m * m, c * d * 2 * m], String), ar: `أوجد ناتج ${c}√${m} × ${d}√${m}`, en: `Find ${c}√${m} × ${d}√${m}` };
});

const radicalEq = topic('radical_eq', /^حل المعادلات الجذريه$/, [9, 9], ({ rng, diff }) => {
  const b = int(rng, 2, 7), a = nz(rng, 9);
  const t = tier(diff);
  if (t === 2) {
    const c = int(rng, 1, 5);
    const x = b * b - a;
    return { eq: `√(x ${a < 0 ? '−' : '+'} ${Math.abs(a)}) + ${c} = ${b + c}`, answer: signed(x), wrongs: num(x, [b + c - a, b - a, (b + c) ** 2 - a, x + 1]), ar: `حلّ المعادلة: √(x ${a < 0 ? '−' : '+'} ${Math.abs(a)}) + ${c} = ${b + c}`, en: `Solve: √(x ${a < 0 ? '−' : '+'} ${Math.abs(a)}) + ${c} = ${b + c}` };
  }
  const x = b * b - a;
  const eq = `√(x ${a < 0 ? '−' : '+'} ${Math.abs(a)}) = ${b}`;
  return { eq, answer: signed(x), wrongs: num(x, [b - a, b + a, b * b + a, x + 1]), ar: `حلّ المعادلة: ${eq}`, en: `Solve: ${eq}` };
});

const ratMulDiv = topic('rat_expr_muldiv', /^ضرب المقادير الجبريه النسبيه وقسمتها$/, [9, 9], ({ rng }) => {
  const [a, b, c] = [nz(rng, 7), nz(rng, 7), nz(rng, 7)];
  if (new Set([a, b, c]).size < 3) return ratMulDiv.make({ rng, diff: 'easy', grade: 9 });
  const div = rng() < 0.5;
  const F = (u: number, v: number) => `(${lin(1, u)})/(${lin(1, v)})`;
  const eq = div ? `${F(a, b)} ÷ ${F(c, b)}` : `${F(a, b)} × ${F(b, c)}`;
  const ans = F(a, c);
  return { eq, answer: ans, wrongs: [F(c, a), F(a, b), F(b, c)].filter(w => w !== ans), ar: `بسّط: ${eq}`, en: `Simplify: ${eq}` };
});

const ratAddSub = topic('rat_expr_addsub', /^جمع المقادير الجبريه النسبيه وطرحها$/, [9, 9], ({ rng }) => {
  for (;;) {
    const a = nz(rng, 4), b = nz(rng, 7), c = nz(rng, 4), d = nz(rng, 7), e = nz(rng, 6);
    const sub = rng() < 0.5;
    const nx = a + (sub ? -c : c), n0 = b + (sub ? -d : d); // numerator nx·x + n0
    if (nx === 0 || n0 === 0) continue;
    if (n0 - nx * e === 0) continue; // the numerator would cancel with the denominator (x + e)
    const N = (u: number, v: number) => polyStr([v, u]);
    const D = lin(1, e);
    const eq = `(${N(a, b)})/(${D}) ${sub ? '−' : '+'} (${N(c, d)})/(${D})`;
    const ans = `(${N(nx, n0)})/(${D})`;
    const wr = [`(${N(nx, b + (sub ? d : -d))})/(${D})`, `(${N(a + c, b + d)})/(${D})`, `(${N(nx, n0)})/(${lin(1, e * 2)})`, `(${N(nx + 1, n0)})/(${D})`]
      .filter((w, i, s) => w !== ans && s.indexOf(w) === i);
    if (wr.length < 3) continue;
    return { eq, answer: ans, wrongs: wr.slice(0, 3), ar: `بسّط: ${eq}`, en: `Simplify: ${eq}` };
  }
});

const ratEq = topic('rat_eq', /^حل المعادلات النسبيه$/, [9, 9], ({ rng }) => {
  const x = int(rng, -5, 9), b = nz(rng, 6);
  if (rng() < 0.5) {
    const m = int(rng, 2, 6);
    if (x + b === 0) return ratEq.make({ rng, diff: 'easy', grade: 9 });
    // m = k / (x + b) with k chosen so m is an integer
    const kk = m * (x + b);
    const eq = `${signed(kk)}/(${lin(1, b)}) = ${m}`;
    return { eq, answer: signed(x), wrongs: num(x, [kk - b, kk / m, x + 1, -x]), ar: `حلّ المعادلة: ${eq}`, en: `Solve: ${eq}` };
  }
  const d = int(rng, 2, 5), c = int(rng, 1, 5), bb = d * int(rng, 1, 4); // (x + a)/bb = c/d  →  x = bb·c/d − a
  const a = bb * c / d - x;
  const eq = `(${lin(1, a)})/${bb} = ${c}/${d}`;
  return { eq, answer: signed(x), wrongs: num(x, [bb * c - a, bb * c / d + a, x + 1, -x]), ar: `حلّ المعادلة: ${eq}`, en: `Solve: ${eq}` };
});

// ─── Grade 8: roots and real numbers ────────────────────────────────────────

const squareRoots = topic('sqrt_basic', /^الجذور التربيعيه$/, [8, 8], ({ rng, diff }) => {
  const r = int(rng, 2, span(diff) + 6);
  const k = pick(rng, [0, 1, 2]);
  if (k === 0) return { eq: `x² = ${r * r}`, answer: `±${r}`, wrongs: [`${r}`, `${r * r}`, `±${r * 2}`], ar: `حلّ المعادلة x² = ${r * r}.`, en: `Solve x² = ${r * r}.` };
  if (k === 1) return { eq: `−√${r * r}`, answer: signed(-r), wrongs: num(-r, [r, -r * r, r * r, -r - 1]), ar: `أوجد قيمة −√${r * r}.`, en: `Find −√${r * r}.` };
  const d = pick(rng, [2, 3, 4, 5, 7]), n = int(rng, 1, d - 1);
  if (gcd(n, d) !== 1) return squareRoots.make({ rng, diff, grade: 8 });
  const ans = `${n}/${d}`;
  return { eq: `√(${n * n}/${d * d})`, answer: ans, wrongs: wrongsFrom(ans, [`${n * n}/${d}`, `${n}/${d * d}`, `${d}/${n}`], j => `${n + Math.abs(j)}/${d}`), ar: `أوجد قيمة √(${n * n}/${d * d}).`, en: `Find √(${n * n}/${d * d}).` };
});

const irrational = topic('sqrt_between', /^الجذور الصماء$/, [8, 8], ({ rng, diff }) => {
  const k = int(rng, 2, span(diff) + 4);
  const n = int(rng, k * k + 1, (k + 1) * (k + 1) - 1);
  const ans = `${k} و ${k + 1}`;
  return { eq: `√${n}`, answer: ans, wrongs: [`${k - 1} و ${k}`, `${k + 1} و ${k + 2}`, `${k - 1} و ${k + 1}`], ar: `بين أي عددين صحيحين متتاليين يقع √${n}؟`, en: `Between which two consecutive integers does √${n} lie?` };
});

const realNumbers = topic('real_numbers', /^الاعداد الحقيقيه$/, [8, 8], ({ rng }) => {
  const SETS = ['الأعداد الطبيعية', 'الأعداد الصحيحة', 'الأعداد النسبية', 'الأعداد الحقيقية'];
  const d = pick(rng, [2, 3, 4, 5, 7]), n = int(rng, 1, d - 1); // a proper fraction is never a whole number
  const tenth = int(rng, 1, 9), whole = int(rng, 1, 9);
  const pool: Array<[string, number]> = [
    [String(int(rng, 2, 40)), 0], [`√${pick(rng, [4, 9, 16, 25, 36, 49])}`, 0], [signed(-int(rng, 1, 30)), 1],
    [`${n}/${d}`, 2], [`${whole}.${tenth}`, 2], [`−${n}/${d}`, 2],
    [`√${pick(rng, [2, 3, 5, 6, 7, 10])}`, 3], ['π', 3],
  ];
  const [x, idx] = pick(rng, pool);
  return {
    eq: x, answer: SETS[idx]!, wrongs: SETS.filter((_, j) => j !== idx),
    ar: `ما أصغر مجموعة من المجموعات الآتية (الطبيعية، الصحيحة، النسبية، الحقيقية) تضم العدد ${x}؟`,
    en: `Which is the smallest of these sets that contains ${x}: natural numbers, integers, rational numbers, real numbers?`,
  };
});



export const ALGEBRA_TOPICS: readonly Topic[] = [
  exprG4, exprEval, oneStep('eq_add_sub', /^معادلات الجمع والطرح$/, ['add', 'sub'], [5, 5]), oneStep('eq_mul_div', /^معادلات الضرب والقسمه$/, ['mul', 'div'], [5, 5]),
  equations, properties, sequences, terms, polyAddSub, polyMul, special, solveEq,
  factorGcf, factorMonic, factorGeneral, factorSpecial,
  writeIneq, ineqAdd, ineqMul, ineqMulti, compound, intervals,
  systemTopic('sys_graph', /^حل نظام من معادلتين خطيتين بيانيا$/, 'graph'), systemTopic('sys_sub', /^حل نظام من معادلتين خطيتين بالتعويض$/, 'sub'), systemTopic('sys_elim', /^حل نظام من معادلتين خطيتين بالحذف$/, 'elim'),
  standardForm, slope, slopeIntercept, pointSlope, parallel,
  quadSolve('quad_factor', /^حل المعادلات التربيعيه بالتحليل$/, ['بالتحليل', 'by factoring']),
  quadSolve('quad_graph', /^حل المعادلات التربيعيه بيانيا$/, ['بيانيًا (جذراها هما الإحداثيان السينيان لنقطتي تقاطع المنحنى مع المحور x)', 'by graphing (the roots are the x-intercepts of the parabola)']),
  quadComplete, quadFormula, quadFunction, quadVertex, functions,
  simplifyExp, radicalOps, radicalEq, ratMulDiv, ratAddSub, ratEq,
  squareRoots, irrational, realNumbers,
];
