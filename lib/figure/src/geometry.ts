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

/**
 * Where a letter goes. A letter is the only cue besides colour, so it must be readable: inside the box and
 * clear of the line it names. The text is start-anchored with its baseline at `y`, so its glyph box is about
 * `x..x+LABEL_W` by `y-LABEL_ASC..y+LABEL_DESC`; the distance that counts is from that box's centre.
 */
export const LABEL_W = 10;
const LABEL_ASC = 11;
const LABEL_DESC = 2;
/** The least distance from a letter's centre to any line it must avoid. */
export const LABEL_CLEAR = 9;
/** The least distance between the centres of two letters. */
export const LABEL_APART = 12;
/** Margin between a letter's box and the edge of the figure. */
const LABEL_EDGE = 2;

const labelCentre = (p: Pt): Pt => ({ x: p.x + LABEL_W / 2, y: p.y - (LABEL_ASC - LABEL_DESC) / 2 });

const labelInside = (p: Pt, box: Box): boolean =>
  p.x >= LABEL_EDGE && p.x + LABEL_W <= box.w - LABEL_EDGE && p.y - LABEL_ASC >= LABEL_EDGE && p.y + LABEL_DESC <= box.h - LABEL_EDGE;

/** The nearest legal text origin to `p`: always inside the box, never NaN, even in a box too small for a letter. */
const labelClamp = (p: Pt, box: Box): Pt => {
  const x = Number.isFinite(p.x) ? p.x : LABEL_EDGE;
  const y = Number.isFinite(p.y) ? p.y : LABEL_EDGE + LABEL_ASC;
  return {
    x: Math.max(LABEL_EDGE, Math.min(box.w - LABEL_EDGE - LABEL_W, x)),
    y: Math.max(LABEL_EDGE + LABEL_ASC, Math.min(box.h - LABEL_EDGE - LABEL_DESC, y)),
  };
};

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function distToLines(p: Pt, lines: Pt[][]): number {
  let d = Infinity;
  for (const line of lines) {
    for (let i = 0; i < line.length; i++) d = Math.min(d, distToSegment(p, line[i]!, line[Math.min(i + 1, line.length - 1)]!));
  }
  return d;
}

/**
 * The first candidate (a text origin, in preference order) whose glyph box is inside the figure, at least
 * `LABEL_CLEAR` from every line in `avoid` and `LABEL_APART` from every letter already placed (`apart`, text
 * origins). When none qualifies, the inside candidate that is furthest from the lines; when none is inside at
 * all, the first candidate pulled into the box. Never returns a point outside the box.
 */
export function placeLabel(candidates: Pt[], avoid: Pt[][], box: Box, apart: Pt[] = []): Pt {
  const usable = candidates.filter(c => Number.isFinite(c.x) && Number.isFinite(c.y));
  const others = apart.map(labelCentre);
  let best: Pt | null = null;
  let bestScore = -Infinity;
  for (const c of usable) {
    if (!labelInside(c, box)) continue;
    const centre = labelCentre(c);
    const dLine = distToLines(centre, avoid);
    let dOther = Infinity;
    for (const o of others) dOther = Math.min(dOther, Math.hypot(centre.x - o.x, centre.y - o.y));
    if (dLine >= LABEL_CLEAR && dOther >= LABEL_APART) return c;
    // Scaled so that "two letters on top of each other" weighs the same as "a letter on its line".
    const score = Math.min(dLine, (dOther * LABEL_CLEAR) / LABEL_APART);
    if (score > bestScore) { best = c; bestScore = score; }
  }
  return best ?? labelClamp(usable[0] ?? { x: 0, y: 0 }, box);
}

/** Offsets from the thing named, nearest-and-most-natural first; the second ring is the same shape, further out. */
const ANCHOR_OFFSETS: Pt[] = [
  { x: 6, y: -8 }, { x: 6, y: 12 }, { x: -14, y: -8 }, { x: -14, y: 12 },
  { x: 0, y: -14 }, { x: 0, y: 18 }, { x: 10, y: 0 }, { x: -18, y: 0 },
];
const aroundAnchor = (anchor: Pt): Pt[] =>
  [1, 1.8, 2.6].flatMap(k => ANCHOR_OFFSETS.map(o => ({ x: anchor.x + o.x * k, y: anchor.y + o.y * k })));

const percentile =(sorted: number[], q: number): number =>
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
    // A marked point is always in the box, whatever the trim would have cut: a
    // question that names «A» must not get a drawing without it.
    for (const p of fig.points ?? []) {
      const f = fns[p.on ?? 0];
      const py = f ? f(p.at) : null;
      if (py !== null && Number.isFinite(py)) { min = Math.min(min, py); max = Math.max(max, py); }
    }
    if (max - min < 1e-9) { min -= 1; max += 1; }
    const pad = (max - min) * 0.1;
    lo = min - pad;
    hi = max + pad;
    // Never fit tighter than a readable span for values this size: a near-flat
    // curve far from zero would otherwise get a scale of millions per unit.
    const minSpan = Math.max(1e-6, 1e-6 * Math.max(Math.abs(lo), Math.abs(hi)));
    if (hi - lo < minSpan) {
      const mid = (lo + hi) / 2;
      lo = mid - minSpan / 2;
      hi = mid + minSpan / 2;
    }
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
  // Letters placed so far (text origins): a later letter keeps clear of them too.
  const placed: Pt[] = [];
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
    // The letter sits at the curve's end, but off the curve: a curve that leaves the corner would otherwise
    // run through its own letter.
    const labelAt = end && label ? placeLabel(aroundAnchor(end), segments, box, placed) : null;
    if (labelAt) placed.push(labelAt);
    return {
      colorIndex: k,
      ...(label ? { label } : {}),
      segments,
      labelAt,
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
    const labelAt = placeLabel(aroundAnchor(at), curves[on]?.segments ?? [], box, placed);
    placed.push(labelAt);
    points.push({ colorIndex: on, label: p.label, at, labelAt });
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

  const shafts = fig.vectors.map(v => [toPx(viewport, v.from[0], v.from[1]), toPx(viewport, v.to[0], v.to[1])]);
  const components: FigureLayout['components'] = [];
  if (fig.components) {
    for (const v of fig.vectors) {
      const a = toPx(viewport, v.from[0], v.from[1]);
      const corner = toPx(viewport, v.to[0], v.from[1]);
      const b = toPx(viewport, v.to[0], v.to[1]);
      components.push({ from: a, to: corner }, { from: corner, to: b });
    }
  }
  // Every shaft and every dashed component line is something a letter must stay off.
  const avoid: Pt[][] = [...shafts, ...components.map(c => [c.from, c.to])];
  const placed: Pt[] = [];

  const arrows = fig.vectors.map((v, i) => {
    const [from, to] = shafts[i]! as [Pt, Pt];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    // The letter's centre goes beside the shaft: both sides of the middle, then the same nearer each end,
    // then further out. A text origin is the glyph's bottom-left, so the centre target moves by (-5, +4.5).
    const nx = -dy / len;
    const ny = dx / len;
    const targets: Pt[] = [];
    for (const dist of [14, 22, 30]) {
      for (const t of [0.5, 0.7, 0.3]) {
        for (const side of [1, -1]) {
          targets.push({ x: from.x + dx * t + nx * dist * side, y: from.y + dy * t + ny * dist * side });
        }
      }
    }
    const labelAt = v.label ? placeLabel(targets.map(t => ({ x: t.x - LABEL_W / 2, y: t.y + (LABEL_ASC - LABEL_DESC) / 2 })), avoid, box, placed) : null;
    if (labelAt) placed.push(labelAt);
    return {
      colorIndex: i % 3,
      ...(v.label ? { label: v.label } : {}),
      from,
      to,
      head: arrowHead(from, to),
      labelAt,
    };
  });

  return { viewport, curves: [], points: [], arrows, components };
}

export function layoutFigure(figure: Figure, box: Box): FigureLayout {
  return figure.kind === 'function-graph' ? layoutGraph(figure, box) : layoutVectors(figure, box);
}
