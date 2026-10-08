/**
 * Pure logic for the whiteboard (سبورة): stroke geometry, the eraser, undo
 * history and the board's background geometry.
 *
 * No React Native and no `expo-*` imports, so `node --test` can load it — the
 * screen and `PenCanvas` render and gather touches, this decides.
 */

/** One stroke. `points` is `"x,y x,y …"` (an SVG polyline), in view pixels. */
export type Stroke = { color: string; points: string; /** Absent means DEFAULT_STROKE_WIDTH. */ width?: number };

/** The slide pen's fixed width — what a stroke without `width` is drawn at. */
export const DEFAULT_STROKE_WIDTH = 4;
/** Thin, medium, thick — offered on the board. */
export const STROKE_WIDTHS = [3, 6, 12] as const;
export const BOARD_DEFAULT_WIDTH = 6;
/** Eraser reach in view pixels, on top of half the stroke's own width. */
export const ERASER_RADIUS = 16;
export const HISTORY_LIMIT = 50;

export type Point = { x: number; y: number };

export function parsePoints(points: string): Point[] {
  const out: Point[] = [];
  for (const pair of points.trim().split(/\s+/)) {
    const [xs, ys] = pair.split(',');
    if (xs === undefined || ys === undefined || xs === '' || ys === '') continue;
    const x = Number(xs);
    const y = Number(ys);
    if (Number.isFinite(x) && Number.isFinite(y)) out.push({ x, y });
  }
  return out;
}

function distanceToSegment(px: number, py: number, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - a.x, py - a.y);
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lenSq));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

type Parsed = { pts: Point[]; minX: number; maxX: number; minY: number; maxY: number };

// Strokes are immutable by convention (PenCanvas builds a new object for every
// change), so the parsed form can be cached by object identity. Never mutate
// `points` in place — the cache would go stale.
const parsedCache = new WeakMap<Stroke, Parsed>();

function parsedOf(stroke: Stroke): Parsed {
  let cached = parsedCache.get(stroke);
  if (!cached) {
    const pts = parsePoints(stroke.points);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    cached = { pts, minX, maxX, minY, maxY };
    parsedCache.set(stroke, cached);
  }
  return cached;
}

/** Does an eraser of `radius` centred on (x, y) touch this stroke? */
export function strokeHit(stroke: Stroke, x: number, y: number, radius: number): boolean {
  const { pts, minX, maxX, minY, maxY } = parsedOf(stroke);
  if (pts.length === 0) return false;
  const reach = radius + (stroke.width ?? DEFAULT_STROKE_WIDTH) / 2;
  // Cheap reject: a point farther than `reach` outside the bounding box cannot
  // be within `reach` of any segment inside it.
  if (x < minX - reach || x > maxX + reach || y < minY - reach || y > maxY + reach) return false;
  if (pts.length === 1) return Math.hypot(x - pts[0]!.x, y - pts[0]!.y) <= reach;
  for (let i = 1; i < pts.length; i++) {
    // Distance to the segment, not to its endpoints: a fast stroke records few
    // points, and an eraser dragged across the gap must still catch it.
    if (distanceToSegment(x, y, pts[i - 1]!, pts[i]!) <= reach) return true;
  }
  return false;
}

/**
 * Remove every stroke the eraser touches. Returns the SAME array when nothing
 * was hit, so a caller can tell "no change" by identity and skip a history step.
 */
export function eraseAt(strokes: Stroke[], x: number, y: number, radius: number = ERASER_RADIUS): Stroke[] {
  const kept = strokes.filter(s => !strokeHit(s, x, y, radius));
  return kept.length === strokes.length ? strokes : kept;
}

/**
 * Erase along the straight path from (x0, y0) to (x1, y1). A fast drag reports
 * positions farther apart than the eraser's reach, so testing only the end
 * points would skip any stroke lying between them; this samples the path at
 * most every half-radius, which keeps the swept area continuous. The start
 * point is NOT tested — the previous call already covered it. Returns the SAME
 * array when nothing was hit, like `eraseAt`.
 */
export function eraseAlong(
  strokes: Stroke[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number = ERASER_RADIUS,
): Stroke[] {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / Math.max(radius / 2, 1)));
  let current = strokes;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    current = eraseAt(current, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, radius);
  }
  return current;
}

/** The strokes on the board plus snapshots to undo back to. */
export type BoardState = { strokes: Stroke[]; past: Stroke[][] };

export const EMPTY_BOARD: BoardState = { strokes: [], past: [] };

/** Make `next` the board's strokes, remembering the old list. Same list in, same state out. */
export function commitStrokes(state: BoardState, next: Stroke[]): BoardState {
  if (next === state.strokes) return state;
  const past = [...state.past, state.strokes];
  return { strokes: next, past: past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past };
}

export function undoBoard(state: BoardState): BoardState {
  if (state.past.length === 0) return state;
  return { strokes: state.past[state.past.length - 1]!, past: state.past.slice(0, -1) };
}

/** Wipe the board — as a commit, so it can be undone. No-op when already empty. */
export function clearBoard(state: BoardState): BoardState {
  return state.strokes.length === 0 ? state : commitStrokes(state, []);
}

export const hasInk = (state: BoardState): boolean => state.strokes.length > 0;
export const canUndo = (state: BoardState): boolean => state.past.length > 0;

export type BoardBackground = 'blank' | 'grid' | 'axes';
export const BOARD_BACKGROUNDS: readonly BoardBackground[] = ['blank', 'grid', 'axes'];
/** Grid square size in view pixels; one axis unit is one square. */
export const BOARD_STEP = 40;

export type Segment = { x1: number; y1: number; x2: number; y2: number };

export function gridLines(width: number, height: number, step: number): Segment[] {
  if (!(width > 0) || !(height > 0) || !(step > 0)) return [];
  const lines: Segment[] = [];
  for (let x = step; x < width; x += step) lines.push({ x1: x, y1: 0, x2: x, y2: height });
  for (let y = step; y < height; y += step) lines.push({ x1: 0, y1: y, x2: width, y2: y });
  return lines;
}

export type AxisTick = { x: number; y: number; value: string; axis: 'x' | 'y' };

/**
 * Axes through the centre, with the origin snapped to a grid line so every tick
 * lands on one. Tick values are Latin strings ("-1", "2"); the component shows
 * them through `localizeDigits`. The origin and the edges get no tick.
 */
export function axesGeometry(
  width: number,
  height: number,
  step: number,
): { xAxis: Segment; yAxis: Segment; ticks: AxisTick[] } {
  const cx = step > 0 ? Math.round(width / 2 / step) * step : width / 2;
  const cy = step > 0 ? Math.round(height / 2 / step) * step : height / 2;
  const xAxis: Segment = { x1: 0, y1: cy, x2: width, y2: cy };
  const yAxis: Segment = { x1: cx, y1: 0, x2: cx, y2: height };
  const ticks: AxisTick[] = [];
  if (!(width > 0) || !(height > 0) || !(step > 0)) return { xAxis, yAxis, ticks };
  for (let k = 1; cx + k * step < width; k++) ticks.push({ axis: 'x', x: cx + k * step, y: cy, value: String(k) });
  for (let k = 1; cx - k * step > 0; k++) ticks.push({ axis: 'x', x: cx - k * step, y: cy, value: String(-k) });
  for (let k = 1; cy - k * step > 0; k++) ticks.push({ axis: 'y', x: cx, y: cy - k * step, value: String(k) });
  for (let k = 1; cy + k * step < height; k++) ticks.push({ axis: 'y', x: cx, y: cy + k * step, value: String(-k) });
  return { xAxis, yAxis, ticks };
}

/** Display-time digit conversion: Arabic-Indic for `ar`, untouched otherwise. */
export function localizeDigits(text: string, lang: string): string {
  return lang === 'ar' ? text.replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!) : text;
}
