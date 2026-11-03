/**
 * The one gate every drawn figure passes: when the model writes it, when the API
 * hands it to a student, when a card is built. It never repairs — a figure
 * outside the limits is refused whole and the caller shows words, as
 * `resolveSlideLayout` does for slide diagrams.
 *
 * A label can never hold a value (1–3 letters, optionally one digit and a
 * prime), which is what stops a drawing giving a question's answer away.
 */
import { compileExpression } from './expression.ts';
import type { Figure, FunctionGraph, VectorsFigure } from './types.ts';

export const FIGURE_LIMITS = {
  maxFunctions: 3,
  maxExprChars: 60,
  maxPoints: 4,
  maxVectors: 5,
  maxXWidth: 40,
  maxXAbs: 50,
  maxYHeight: 200,
  maxYAbs: 1000,
  maxCoord: 12,
  maxBytes: 1500,
  samples: 200,
  minFiniteShare: 0.8,
} as const;

const L = FIGURE_LIMITS;
const LABEL = /^[A-Za-zء-ي]{1,3}[0-9]?['′]?$/u;

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPair = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1]);
const isLabel = (v: unknown): v is string => typeof v === 'string' && LABEL.test(v);
const onHalfGrid = (v: number) => Math.abs(v) <= L.maxCoord && Math.abs(v * 2 - Math.round(v * 2)) < 1e-9;

function resolveGraph(raw: Rec): FunctionGraph | null {
  const fns = raw['functions'];
  if (!Array.isArray(fns) || fns.length < 1 || fns.length > L.maxFunctions) return null;
  const functions: FunctionGraph['functions'] = [];
  const compiled: ((x: number) => number | null)[] = [];
  const labels = new Set<string>();
  for (const f of fns) {
    if (!isRec(f) || typeof f['expr'] !== 'string') return null;
    const expr = f['expr'].trim();
    if (expr.length < 1 || expr.length > L.maxExprChars) return null;
    const fn = compileExpression(expr);
    if (!fn) return null;
    compiled.push(fn);
    const label = f['label'];
    if (label === undefined) {
      functions.push({ expr });
    } else {
      if (!isLabel(label) || labels.has(label)) return null;
      labels.add(label);
      functions.push({ expr, label });
    }
  }

  const xr = raw['x'];
  if (!isPair(xr)) return null;
  const [x0, x1] = xr;
  if (!(x1 > x0) || x1 - x0 > L.maxXWidth || Math.abs(x0) > L.maxXAbs || Math.abs(x1) > L.maxXAbs) return null;

  const dx = (x1 - x0) / (L.samples - 1);
  for (const fn of compiled) {
    let finite = 0;
    for (let i = 0; i < L.samples; i++) {
      const y = fn(x0 + i * dx);
      if (y !== null && Number.isFinite(y)) finite++;
    }
    if (finite / L.samples < L.minFiniteShare) return null;
  }

  let y: [number, number] | undefined;
  if (raw['y'] !== undefined) {
    const yr = raw['y'];
    if (!isPair(yr)) return null;
    const [y0, y1] = yr;
    if (!(y1 > y0) || y1 - y0 > L.maxYHeight || Math.abs(y0) > L.maxYAbs || Math.abs(y1) > L.maxYAbs) return null;
    y = [y0, y1];
  }

  const points: NonNullable<FunctionGraph['points']> = [];
  if (raw['points'] !== undefined) {
    const list = raw['points'];
    if (!Array.isArray(list) || list.length > L.maxPoints) return null;
    for (const p of list) {
      if (!isRec(p)) return null;
      const at = p['at'];
      const label = p['label'];
      if (!isNum(at) || at < x0 || at > x1 || !isLabel(label)) return null;
      const on = p['on'] === undefined ? 0 : p['on'];
      if (typeof on !== 'number' || !Number.isInteger(on) || on < 0 || on >= compiled.length) return null;
      const py = compiled[on]!(at);
      if (py === null || !Number.isFinite(py)) return null;
      points.push({ at, label, on });
    }
  }

  return {
    kind: 'function-graph',
    functions,
    x: [x0, x1],
    ...(y ? { y } : {}),
    ...(points.length > 0 ? { points } : {}),
  };
}

function resolveVectors(raw: Rec): VectorsFigure | null {
  const list = raw['vectors'];
  if (!Array.isArray(list) || list.length < 1 || list.length > L.maxVectors) return null;
  const vectors: VectorsFigure['vectors'] = [];
  const labels = new Set<string>();
  for (const v of list) {
    if (!isRec(v)) return null;
    const from = v['from'];
    const to = v['to'];
    if (!isPair(from) || !isPair(to)) return null;
    if (![...from, ...to].every(onHalfGrid)) return null;
    if (from[0] === to[0] && from[1] === to[1]) return null;
    const label = v['label'];
    if (label === undefined) {
      vectors.push({ from: [from[0], from[1]], to: [to[0], to[1]] });
    } else {
      if (!isLabel(label) || labels.has(label)) return null;
      labels.add(label);
      vectors.push({ from: [from[0], from[1]], to: [to[0], to[1]], label });
    }
  }
  const components = raw['components'];
  if (components !== undefined && typeof components !== 'boolean') return null;
  return { kind: 'vectors', vectors, ...(components === true ? { components: true } : {}) };
}

export function resolveFigure(raw: unknown): Figure | null {
  try {
    if (!isRec(raw)) return null;
    const out = raw['kind'] === 'function-graph' ? resolveGraph(raw)
      : raw['kind'] === 'vectors' ? resolveVectors(raw)
        : null;
    if (!out) return null;
    return JSON.stringify(out).length <= L.maxBytes ? out : null;
  } catch {
    return null;
  }
}

/**
 * Does a drawn function agree with the function an exam question's `check`
 * was written for? A different function means the picture and the checked key
 * are about two things, so the caller drops the picture. When the check is an
 * equation, absent, or compares too few points, this cannot tell and says yes —
 * it is a narrow guard, not a proof the drawing is right.
 */
export function figureConsistentWith(figure: Figure, checkQuestion: string | null | undefined): boolean {
  if (figure.kind !== 'function-graph' || !checkQuestion) return true;
  const checked = compileExpression(checkQuestion.trim());
  if (!checked) return true;
  const [x0, x1] = figure.x;
  const xs = Array.from({ length: 24 }, (_, i) => x0 + ((x1 - x0) * i) / 23);
  let compared = 0;
  for (const { expr } of figure.functions) {
    const drawn = compileExpression(expr);
    if (!drawn) continue;
    let same = true;
    let n = 0;
    for (const x of xs) {
      const a = drawn(x);
      const b = checked(x);
      if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) continue;
      n++;
      if (Math.abs(a - b) > 1e-6 * Math.max(1, Math.abs(a), Math.abs(b))) { same = false; break; }
    }
    // A mismatch breaks out early, so `n` is small then; one differing point is
    // already a definite disagreement and must count as a comparison.
    if (same && n < 8) continue;
    compared++;
    if (same) return true;
  }
  return compared === 0;
}
