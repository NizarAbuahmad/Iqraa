/**
 * The view onto the plane, shared by the grapher and (later) the sketchpad.
 * Pure and free of react-native, so the gestures can be tested without a screen.
 *
 * A viewport is the world point at the middle of the canvas, a scale per axis
 * in pixels per unit, and the canvas size. y points up in the world and down on
 * screen, so `toPx` flips it. The standard view is equal-aspect: a circle of
 * radius 5 is the same size across as up. The trig presets are not, on purpose:
 * the book draws sin x over 0°…360° and −1…1, which no equal-aspect view can.
 */
export type Viewport = {
  /** The world point at the middle of the canvas. */
  cx: number;
  cy: number;
  /** Pixels per world unit, per axis. */
  sx: number;
  sy: number;
  /** The canvas size in pixels. */
  w: number;
  h: number;
};

export type ViewPreset = 'standard' | 'trig-deg' | 'trig-rad';
export type Point = { x: number; y: number };

/** Below this a label is 1e-300 wide, above it a pixel is a thousandth of a unit. */
export const MIN_SCALE = 0.05;
export const MAX_SCALE = 5000;

const clampScale = (s: number): number => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

export function makeViewport(w: number, h: number, preset: ViewPreset): Viewport {
  switch (preset) {
    case 'standard': {
      const s = Math.min(w, h) / 20;
      return { cx: 0, cy: 0, sx: s, sy: s, w, h };
    }
    case 'trig-deg':
      // x from −45° to 405° (a period with margin), y from −1.5 to 1.5.
      return { cx: 180, cy: 0, sx: w / 450, sy: h / 3, w, h };
    case 'trig-rad':
      return { cx: Math.PI, cy: 0, sx: w / (2 * Math.PI + 1), sy: h / 3, w, h };
  }
}

export function bounds(vp: Viewport): { xMin: number; xMax: number; yMin: number; yMax: number } {
  const hx = vp.w / (2 * vp.sx);
  const hy = vp.h / (2 * vp.sy);
  return { xMin: vp.cx - hx, xMax: vp.cx + hx, yMin: vp.cy - hy, yMax: vp.cy + hy };
}

export function toPx(vp: Viewport, x: number, y: number): Point {
  return { x: vp.w / 2 + (x - vp.cx) * vp.sx, y: vp.h / 2 - (y - vp.cy) * vp.sy };
}

export function toWorld(vp: Viewport, px: number, py: number): Point {
  return { x: vp.cx + (px - vp.w / 2) / vp.sx, y: vp.cy - (py - vp.h / 2) / vp.sy };
}

/** Drag the world by `dx, dy` pixels: the point under the finger stays under it. */
export function panBy(vp: Viewport, dx: number, dy: number): Viewport {
  return { ...vp, cx: vp.cx - dx / vp.sx, cy: vp.cy + dy / vp.sy };
}

/**
 * Zoom by `factor` about the pixel `(ax, ay)`, which stays on the same world
 * point. Both axes by default, so an equal-aspect view stays equal-aspect (the
 * clamp is the same for both when they start equal); `axis` scales one only.
 * A zero, negative or non-finite factor is ignored.
 */
export function zoomAt(
  vp: Viewport,
  factor: number,
  ax: number,
  ay: number,
  axis: 'both' | 'x' | 'y' = 'both',
): Viewport {
  if (!Number.isFinite(factor) || factor <= 0) return vp;
  const anchor = toWorld(vp, ax, ay);
  const sx = axis === 'y' ? vp.sx : clampScale(vp.sx * factor);
  const sy = axis === 'x' ? vp.sy : clampScale(vp.sy * factor);
  return {
    ...vp,
    sx,
    sy,
    cx: anchor.x - (ax - vp.w / 2) / sx,
    cy: anchor.y + (ay - vp.h / 2) / sy,
  };
}

/** A new canvas size, keeping the centre and the scales: more or less world shows. */
export function resize(vp: Viewport, w: number, h: number): Viewport {
  return { ...vp, w, h };
}

/** The «1:1» button: make a free-aspect view equal-aspect, keeping the x scale. */
export function equalize(vp: Viewport): Viewport {
  return { ...vp, sy: vp.sx };
}

/**
 * What two fingers moving from `prev` to `cur` mean: a zoom about their new
 * midpoint, and the pan their midpoint travelled. Null unless both are exactly
 * two points and the first pair had some distance to compare.
 */
export function pinchDelta(
  prev: Point[],
  cur: Point[],
): { factor: number; anchorX: number; anchorY: number; panX: number; panY: number } | null {
  if (prev.length !== 2 || cur.length !== 2) return null;
  const dPrev = Math.hypot(prev[1].x - prev[0].x, prev[1].y - prev[0].y);
  const dCur = Math.hypot(cur[1].x - cur[0].x, cur[1].y - cur[0].y);
  if (dPrev < 1e-6) return null;
  const mp = { x: (prev[0].x + prev[1].x) / 2, y: (prev[0].y + prev[1].y) / 2 };
  const mc = { x: (cur[0].x + cur[1].x) / 2, y: (cur[0].y + cur[1].y) / 2 };
  return { factor: dCur / dPrev, anchorX: mc.x, anchorY: mc.y, panX: mc.x - mp.x, panY: mc.y - mp.y };
}

const DEGREE_STEPS = [1, 2, 5, 10, 15, 30, 45, 90, 180, 360];

/**
 * The grid step: the smallest «1, 2 or 5 × a power of ten» (or, in degree mode,
 * 15° / 30° / 45° / 90° …) that is at least `minPx` pixels wide at this scale.
 */
export function niceStep(pxPerUnit: number, minPx = 56, mode: 'decimal' | 'deg' = 'decimal'): number {
  const minUnits = minPx / pxPerUnit;
  const ok = (step: number) => step * pxPerUnit >= minPx - 1e-9;
  if (mode === 'deg' && minUnits >= 1) {
    for (const s of DEGREE_STEPS) if (ok(s)) return s;
    let s = 720;
    while (!ok(s)) s *= 2;
    return s;
  }
  let k = Math.floor(Math.log10(minUnits)) - 1;
  for (;;) {
    for (const m of [1, 2, 5]) {
      const step = Number((m * Math.pow(10, k)).toPrecision(12));
      if (ok(step)) return step;
    }
    k += 1;
  }
}

export type Tick = { value: number; px: number };

function decimalsOf(step: number): number {
  return step >= 1 ? 0 : Math.max(0, Math.ceil(-Math.log10(step) - 1e-9));
}

function ticksBetween(min: number, max: number, step: number, pxOf: (v: number) => number): Tick[] {
  const decimals = decimalsOf(step);
  const out: Tick[] = [];
  for (let k = Math.ceil(min / step - 1e-9); k <= Math.floor(max / step + 1e-9); k++) {
    const value = Number((k * step).toFixed(decimals));
    out.push({ value: value === 0 ? 0 : value, px: pxOf(value) });
  }
  return out;
}

/** Grid lines for each axis, as clean values (0.3, not 0.30000000000000004) with their pixel. */
export function gridTicks(vp: Viewport, xMode: 'decimal' | 'deg' = 'decimal'): { xs: Tick[]; ys: Tick[] } {
  const b = bounds(vp);
  const xStep = niceStep(vp.sx, 56, xMode);
  const yStep = niceStep(vp.sy, 40, 'decimal');
  return {
    xs: ticksBetween(b.xMin, b.xMax, xStep, v => toPx(vp, v, 0).x),
    ys: ticksBetween(b.yMin, b.yMax, yStep, v => toPx(vp, 0, v).y),
  };
}
