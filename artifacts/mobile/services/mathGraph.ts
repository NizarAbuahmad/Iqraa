/**
 * The grapher's model: what a teacher typed, the curve as drawable pieces, and
 * the points worth marking on it. Pure and free of react-native.
 *
 * Fails closed. An implicit equation such as x² + y² = 25 is refused by name
 * rather than graphed as something else (circles come from the sketchpad). A
 * curve is drawn only where the function is defined, and is broken at a pole so
 * tan and 1/x never get a vertical line through the asymptote. A root is
 * reported only if the function really is (near) zero there: a sign change
 * across a pole is not a root.
 */
import { evaluate, normaliseInput } from './mathExpr.ts';
import { bounds, toPx, type Point, type Viewport } from './mathViewport.ts';

// ---------------------------------------------------------------------------
// What was typed

export type CurveInput =
  | { ok: true; kind: 'explicit'; expr: string }
  | { ok: true; kind: 'vertical'; x: number }
  | { ok: false; reason: 'empty' | 'implicit-unsupported' | 'bad-vertical' };

const EXPLICIT_LHS = /^(?:y|[fgh]\(x\))$/i;

/** `y = …`, `f(x) = …`, a bare expression, or `x = number`. Anything else is refused. */
export function parseCurveInput(src: string): CurveInput {
  const s = normaliseInput(src).replace(/ص/g, 'y');
  if (s === '') return { ok: false, reason: 'empty' };

  const parts = s.split('=');
  if (parts.length === 1) return { ok: true, kind: 'explicit', expr: s };
  if (parts.length > 2) return { ok: false, reason: 'implicit-unsupported' };

  const lhs = parts[0].trim();
  const rhs = parts[1].trim();
  if (EXPLICIT_LHS.test(lhs)) {
    return rhs === '' ? { ok: false, reason: 'empty' } : { ok: true, kind: 'explicit', expr: rhs };
  }
  if (lhs === 'x') {
    const r = evaluate(rhs);
    return r.ok ? { ok: true, kind: 'vertical', x: r.value } : { ok: false, reason: 'bad-vertical' };
  }
  return { ok: false, reason: 'implicit-unsupported' };
}

// ---------------------------------------------------------------------------
// Drawing

/** Past this a coordinate can silently fail to draw on Android. */
const PIXEL_CLAMP = 1e5;

/**
 * The curve as pixel polylines, one sample every ~2 px. A piece ends where the
 * function is undefined, and where it changes sign while jumping more than the
 * canvas is tall — an asymptote. The pole usually falls *between* two samples
 * (so neither is undefined); 3× the height missed a pole at ordinary zoom, where
 * 1/(x−0.05) jumps only ~650 px, and drew a line through it. A steep curve that
 * keeps its sign (x⁷) stays one piece. Pieces of a single point are dropped.
 */
export function curveSegments(f: (x: number) => number, vp: Viewport): Point[][] {
  const b = bounds(vp);
  const n = Math.max(2, Math.ceil(vp.w / 2));
  const segments: Point[][] = [];
  let cur: Point[] = [];
  let prevY = Number.NaN;
  let prevPy = Number.NaN;

  const flush = () => {
    if (cur.length >= 2) segments.push(cur);
    cur = [];
  };

  for (let i = 0; i <= n; i++) {
    const x = b.xMin + ((b.xMax - b.xMin) * i) / n;
    const y = f(x);
    if (!Number.isFinite(y)) {
      flush();
      continue;
    }
    const p = toPx(vp, x, y);
    const py = Math.max(-PIXEL_CLAMP, Math.min(PIXEL_CLAMP, p.y));
    if (cur.length > 0 && Math.sign(y) !== Math.sign(prevY) && Math.abs(py - prevPy) > vp.h) flush();
    cur.push({ x: p.x, y: py });
    prevY = y;
    prevPy = py;
  }
  flush();
  return segments;
}

/** An SVG path `d`: one `M` per piece, one decimal, never NaN or Infinity. */
export function toPathD(segments: Point[][]): string {
  return segments
    .map(seg =>
      seg
        .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y))
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(''),
    )
    .join('');
}

/** `x = c`: the full height of the canvas at that pixel. */
export function verticalLine(x: number, vp: Viewport): Point[] {
  const px = toPx(vp, x, 0).x;
  return [{ x: px, y: 0 }, { x: px, y: vp.h }];
}

// ---------------------------------------------------------------------------
// Points worth marking

const SAMPLES = 600;
const MAX_POINTS = 20;

const round6 = (n: number): number => {
  const r = Number(n.toFixed(6));
  return r === 0 ? 0 : r;
};

function dedupeSorted(values: number[]): number[] {
  const out: number[] = [];
  for (const v of [...values].sort((a, b) => a - b)) {
    if (out.length === 0 || Math.abs(v - out[out.length - 1]) > 1e-6) out.push(v);
  }
  return out;
}

const finiteOr = (v: number, fallback: number): number => (Number.isFinite(v) ? v : fallback);

/** Golden-section search for the x in [a, b] that minimises g. Non-finite counts as +∞. */
function goldenMin(g: (x: number) => number, a: number, b: number): number {
  const phi = (Math.sqrt(5) - 1) / 2;
  const eval_ = (x: number) => finiteOr(g(x), Infinity);
  let c = b - phi * (b - a);
  let d = a + phi * (b - a);
  let gc = eval_(c);
  let gd = eval_(d);
  for (let i = 0; i < 100 && Math.abs(b - a) > 1e-12; i++) {
    if (gc < gd) {
      b = d;
      d = c;
      gd = gc;
      c = b - phi * (b - a);
      gc = eval_(c);
    } else {
      a = c;
      c = d;
      gc = gd;
      d = a + phi * (b - a);
      gd = eval_(d);
    }
  }
  return (a + b) / 2;
}

function bisect(f: (x: number) => number, a: number, b: number, fa: number): number {
  for (let i = 0; i < 100; i++) {
    const m = (a + b) / 2;
    const fm = f(m);
    if (!Number.isFinite(fm)) return Number.NaN;
    if (fm === 0) return m;
    if (fa * fm < 0) b = m;
    else {
      a = m;
      fa = fm;
    }
    if (b - a < 1e-14 * Math.max(1, Math.abs(a))) break;
  }
  return (a + b) / 2;
}

/**
 * The zeros of f on [xMin, xMax]: sign changes (refined by bisection and
 * rejected if the function is not actually near zero there — a pole), exact
 * zeros, and tangential roots such as x² at 0, where the curve touches the axis
 * without crossing. A function that is zero almost everywhere has none to report.
 */
export function findRoots(f: (x: number) => number, xMin: number, xMax: number): number[] {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const x = xMin + ((xMax - xMin) * i) / SAMPLES;
    xs.push(x);
    ys.push(f(x));
  }
  if (ys.filter(y => y === 0).length > SAMPLES / 2) return [];

  const roots: number[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const y = ys[i];
    if (y === 0) roots.push(xs[i]);

    if (i < SAMPLES) {
      const y1 = ys[i + 1];
      if (Number.isFinite(y) && Number.isFinite(y1) && y * y1 < 0) {
        const r = bisect(f, xs[i], xs[i + 1], y);
        const scale = Math.max(1, Math.abs(y), Math.abs(y1));
        if (Number.isFinite(r) && Math.abs(f(r)) <= 1e-6 * scale) roots.push(r);
      }
    }

    if (i >= 1 && i < SAMPLES) {
      const a = ys[i - 1];
      const c = ys[i + 1];
      if (
        Number.isFinite(a) && Number.isFinite(y) && Number.isFinite(c) &&
        a * y > 0 && y * c > 0 &&
        Math.abs(y) <= Math.abs(a) && Math.abs(y) <= Math.abs(c) &&
        (Math.abs(y) < Math.abs(a) || Math.abs(y) < Math.abs(c))
      ) {
        const r = goldenMin(x => Math.abs(f(x)), xs[i - 1], xs[i + 1]);
        const scale = Math.max(1, Math.abs(a), Math.abs(c));
        if (Math.abs(f(r)) <= 1e-7 * scale) roots.push(r);
      }
    }
  }
  return dedupeSorted(roots.map(round6)).slice(0, MAX_POINTS);
}

export type Extremum = { kind: 'min' | 'max'; x: number; y: number };

/**
 * Local maxima and minima on [xMin, xMax]. A candidate next to a pole (where the
 * "peak" is the curve running off to infinity) is rejected, as is one that
 * lands on the edge of its search interval.
 */
export function findExtrema(f: (x: number) => number, xMin: number, xMax: number): Extremum[] {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const x = xMin + ((xMax - xMin) * i) / SAMPLES;
    xs.push(x);
    ys.push(f(x));
  }
  const out: Extremum[] = [];
  for (let i = 1; i < SAMPLES; i++) {
    const a = ys[i - 1];
    const b = ys[i];
    const c = ys[i + 1];
    if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) continue;
    const isMax = b > a && b >= c;
    const isMin = b < a && b <= c;
    if (!isMax && !isMin) continue;

    const lo = xs[i - 1];
    const hi = xs[i + 1];
    const x = goldenMin(t => (isMax ? -f(t) : f(t)), lo, hi);
    const y = f(x);
    const margin = 0.01 * (hi - lo);
    if (!Number.isFinite(y) || Math.abs(y) > 1e8 || x - lo < margin || hi - x < margin) continue;
    out.push({ kind: isMax ? 'max' : 'min', x: round6(x), y: round6(y) });
  }
  const unique: Extremum[] = [];
  for (const e of out) {
    if (!unique.some(u => u.kind === e.kind && Math.abs(u.x - e.x) < 1e-6)) unique.push(e);
  }
  return unique.sort((p, q) => p.x - q.x).slice(0, MAX_POINTS);
}

/** Where f and g meet: the roots of f − g, each with its y. */
export function findIntersections(
  f: (x: number) => number,
  g: (x: number) => number,
  xMin: number,
  xMax: number,
): Point[] {
  const diff = (x: number) => {
    const a = f(x);
    const b = g(x);
    return Number.isFinite(a) && Number.isFinite(b) ? a - b : Number.NaN;
  };
  return findRoots(diff, xMin, xMax).map(x => ({ x, y: round6(f(x)) }));
}

/** The curve at x, or null where it is undefined. */
export function traceAt(f: (x: number) => number, x: number): Point | null {
  const y = f(x);
  return Number.isFinite(y) ? { x, y } : null;
}
