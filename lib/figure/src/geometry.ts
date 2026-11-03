/**
 * Where everything goes. Pure: a figure and a box in, pixel primitives out, so
 * the app (react-native-svg), the review script (`figureSvg`) and any later
 * export draw the same picture.
 */
import { compileExpression } from './expression.ts';
import type { Figure, FunctionGraph, VectorsFigure } from './types.ts';
import { toPx, type Viewport } from './viewport.ts';

export type Pt = { x: number; y: number };
export type Box = { w: number; h: number };

export type FigureLayout = {
  viewport: Viewport;
  curves: { colorIndex: number; label?: string; segments: Pt[][]; labelAt: Pt | null }[];
  points: { colorIndex: number; label: string; at: Pt; labelAt: Pt }[];
  arrows: { colorIndex: number; label?: string; from: Pt; to: Pt; head: [Pt, Pt, Pt]; labelAt: Pt | null }[];
  components: { from: Pt; to: Pt }[];
};

const SAMPLES = 240;

const clampPt = (p: Pt, box: Box): Pt => ({
  x: Math.min(box.w - 14, Math.max(4, p.x)),
  y: Math.min(box.h - 4, Math.max(12, p.y)),
});

const percentile = (sorted: number[], q: number): number =>
  sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))]!;

function layoutGraph(fig: FunctionGraph, box: Box): FigureLayout {
  const fns = fig.functions.map(f => compileExpression(f.expr));
  const [x0, x1] = fig.x;
  const dx = (x1 - x0) / (SAMPLES - 1);
  const series = fns.map(fn =>
    Array.from({ length: SAMPLES }, (_, i) => {
      const x = x0 + i * dx;
      const y = fn ? fn(x) : null;
      return { x, y: y !== null && Number.isFinite(y) ? y : null };
    }),
  );

  // The range: given, or fitted to the 2nd–98th percentile of the samples so one
  // asymptote spike cannot flatten the rest of the curve.
  let lo: number;
  let hi: number;
  if (fig.y) {
    [lo, hi] = fig.y;
  } else {
    const ys = series.flat().map(s => s.y).filter((y): y is number => y !== null).sort((a, b) => a - b);
    let min = ys.length ? percentile(ys, 0.02) : -1;
    let max = ys.length ? percentile(ys, 0.98) : 1;
    if (max - min < 1e-9) { min -= 1; max += 1; }
    const pad = (max - min) * 0.1;
    lo = min - pad;
    hi = max + pad;
    const span = hi - lo;
    // Keep the x axis in view when it is close to the data.
    if (lo > 0 && hi <= 4 * span) lo = -0.1 * span;
    else if (hi < 0 && -lo <= 4 * span) hi = 0.1 * span;
  }
  const span = hi - lo;
  const viewport: Viewport = {
    cx: (x0 + x1) / 2,
    cy: (lo + hi) / 2,
    sx: box.w / ((x1 - x0) * 1.08),
    sy: box.h / span,
    w: box.w,
    h: box.h,
  };

  const clip = span * 3;
  const curves = series.map((s, k) => {
    // A jump across zero much bigger than a normal step is an asymptote, not a line.
    const steps: number[] = [];
    for (let i = 1; i < s.length; i++) {
      const a = s[i - 1]!.y;
      const b = s[i]!.y;
      if (a !== null && b !== null) steps.push(Math.abs(b - a));
    }
    steps.sort((a, b) => a - b);
    const jump = 8 * (steps.length ? steps[Math.floor(steps.length / 2)]! : 0);

    const runs: Pt[][] = [];
    let cur: Pt[] | null = null;
    let prevY: number | null = null;
    for (const p of s) {
      const y = p.y;
      if (y === null || y < lo - clip || y > hi + clip) { cur = null; prevY = null; continue; }
      if (cur !== null && prevY !== null && Math.sign(y) !== Math.sign(prevY) && Math.abs(y - prevY) > jump) cur = null;
      if (cur === null) { cur = []; runs.push(cur); }
      cur.push(toPx(viewport, p.x, y));
      prevY = y;
    }
    const segments = runs.filter(r => r.length >= 2);
    const last = segments[segments.length - 1];
    const end = last ? last[last.length - 1]! : null;
    const label = fig.functions[k]!.label;
    return {
      colorIndex: k,
      ...(label ? { label } : {}),
      segments,
      labelAt: end ? clampPt({ x: end.x + 4, y: end.y - 6 }, box) : null,
    };
  });

  const points: FigureLayout['points'] = [];
  for (const p of fig.points ?? []) {
    const on = p.on ?? 0;
    const f = fns[on];
    const y = f ? f(p.at) : null;
    if (y === null || !Number.isFinite(y)) continue;
    const at = toPx(viewport, p.at, y);
    // Off the canvas (a zoomed-in range): draw nothing, not a label floating in a corner.
    if (at.x < 0 || at.x > box.w || at.y < 0 || at.y > box.h) continue;
    points.push({ colorIndex: on, label: p.label, at, labelAt: clampPt({ x: at.x + 6, y: at.y - 8 }, box) });
  }

  return { viewport, curves, points, arrows: [], components: [] };
}

function arrowHead(from: Pt, to: Pt): [Pt, Pt, Pt] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const head = Math.min(10, len * 0.4);
  const half = head * 0.45;
  const bx = to.x - ux * head;
  const by = to.y - uy * head;
  return [to, { x: bx - uy * half, y: by + ux * half }, { x: bx + uy * half, y: by - ux * half }];
}

function layoutVectors(fig: VectorsFigure, box: Box): FigureLayout {
  const xs = [0, ...fig.vectors.flatMap(v => [v.from[0], v.to[0]])];
  const ys = [0, ...fig.vectors.flatMap(v => [v.from[1], v.to[1]])];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 4) + 2;
  const spanY = Math.max(maxY - minY, 4) + 2;
  const s = Math.min(box.w / spanX, box.h / spanY);
  const viewport: Viewport = { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, sx: s, sy: s, w: box.w, h: box.h };

  const arrows = fig.vectors.map((v, i) => {
    const from = toPx(viewport, v.from[0], v.from[1]);
    const to = toPx(viewport, v.to[0], v.to[1]);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    return {
      colorIndex: i % 3,
      ...(v.label ? { label: v.label } : {}),
      from,
      to,
      head: arrowHead(from, to),
      labelAt: v.label ? clampPt({ x: mid.x - (dy / len) * 12, y: mid.y + (dx / len) * 12 }, box) : null,
    };
  });

  const components: FigureLayout['components'] = [];
  if (fig.components) {
    for (const v of fig.vectors) {
      const a = toPx(viewport, v.from[0], v.from[1]);
      const corner = toPx(viewport, v.to[0], v.from[1]);
      const b = toPx(viewport, v.to[0], v.to[1]);
      components.push({ from: a, to: corner }, { from: corner, to: b });
    }
  }
  return { viewport, curves: [], points: [], arrows, components };
}

export function layoutFigure(figure: Figure, box: Box): FigureLayout {
  return figure.kind === 'function-graph' ? layoutGraph(figure, box) : layoutVectors(figure, box);
}
