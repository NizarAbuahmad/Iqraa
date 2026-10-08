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

/** Does an eraser of `radius` centred on (x, y) touch this stroke? */
export function strokeHit(stroke: Stroke, x: number, y: number, radius: number): boolean {
  const pts = parsePoints(stroke.points);
  if (pts.length === 0) return false;
  const reach = radius + (stroke.width ?? DEFAULT_STROKE_WIDTH) / 2;
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
