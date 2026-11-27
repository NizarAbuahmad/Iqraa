/**
 * Pure logic for the whiteboard (سبورة): stroke geometry, the eraser, undo
 * history and the board's background geometry.
 *
 * No React Native and no `expo-*` imports, so `node --test` can load it — the
 * screen and `PenCanvas` render and gather touches, this decides.
 */
import type { BoardSolution } from '@workspace/math-verify';

/**
 * One stroke. `points` is `"x,y x,y …"` (an SVG polyline) in whatever units the
 * canvas stores — on screen they are fractions of the canvas width
 * (`services/penInk.ts`). `width` is in width units: on the board, canvas units
 * of the 1280x720 page, multiplied by `strokeScale` to get screen pixels; slide
 * strokes keep pixel widths (`strokeScale` 1). The geometry below is
 * unit-agnostic: callers pass the touch, the eraser radius and `unit` (one
 * width unit expressed in point units) in the same units as the points.
 */
export type Stroke = { color: string; points: string; /** Absent means DEFAULT_STROKE_WIDTH. */ width?: number };

/** The slide pen's fixed width — what a stroke without `width` is drawn at. */
export const DEFAULT_STROKE_WIDTH = 4;
/** Thin, medium, thick — offered on the board. */
export const STROKE_WIDTHS = [3, 6, 12] as const;
export const BOARD_DEFAULT_WIDTH = 6;
/** Eraser reach in pixels, on top of half the stroke's own width. */
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

/**
 * Does an eraser of `radius` centred on (x, y) touch this stroke? `x`, `y`,
 * `radius` and the stroke's points share one unit; `unit` is one stroke-width
 * unit in that unit (default 1: points are in width units), which is what turns
 * the stroke's `width` into the right amount of reach. The board passes
 * `strokeScale / canvasW`; slides pass `1 / canvasW`, where a width unit is a
 * pixel. `radius` is NOT scaled by `unit`: the eraser's own reach is fixed.
 */
export function strokeHit(stroke: Stroke, x: number, y: number, radius: number, unit = 1): boolean {
  const { pts, minX, maxX, minY, maxY } = parsedOf(stroke);
  if (pts.length === 0) return false;
  const reach = radius + ((stroke.width ?? DEFAULT_STROKE_WIDTH) / 2) * unit;
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
export function eraseAt(strokes: Stroke[], x: number, y: number, radius: number = ERASER_RADIUS, unit = 1): Stroke[] {
  const kept = strokes.filter(s => !strokeHit(s, x, y, radius, unit));
  return kept.length === strokes.length ? strokes : kept;
}

/**
 * Erase along the straight path from (x0, y0) to (x1, y1). A fast drag reports
 * positions farther apart than the eraser's reach, so testing only the end
 * points would skip any stroke lying between them; this samples the path at
 * most every half-radius (never finer than one `unit`), which keeps the swept
 * area continuous. The start point is NOT tested — the previous call already
 * covered it. `unit` is one stroke-width unit in the points' unit, as for
 * `strokeHit`.
 * Returns the SAME array when nothing was hit, like `eraseAt`.
 */
export function eraseAlong(
  strokes: Stroke[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number = ERASER_RADIUS,
  unit = 1,
): Stroke[] {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / Math.max(radius / 2, unit)));
  let current = strokes;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    current = eraseAt(current, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, radius, unit);
  }
  return current;
}

/**
 * A piece of typed text on the page. `x`/`y` are canvas units of the 1280x720 page
 * (like a stroke's width, not fractions of the width): `y` is the top of the first
 * line, and `x` is the START edge of every line — the left edge of an English item,
 * the RIGHT edge of an Arabic one (`rtl`) — so a line needs no measuring to be placed,
 * on the screen or in the PDF. `size` is the font size in canvas units. Lines are
 * exactly as typed: nothing wraps, and what runs past the page edge is clipped.
 */
export type TextItem = { x: number; y: number; size: number; color: string; rtl: boolean; text: string };

/** What undo and redo move between: the strokes AND the texts, so one history covers both. */
export type BoardSnapshot = { strokes: Stroke[]; texts: TextItem[] };

/**
 * The strokes and texts on the board plus snapshots to undo back to (`past`, oldest
 * first) and to redo forward to (`future`, the next redo first). `future` is empty
 * until something is undone, and any new commit empties it again.
 */
export type BoardState = { strokes: Stroke[]; texts: TextItem[]; past: BoardSnapshot[]; future: BoardSnapshot[] };

export const EMPTY_BOARD: BoardState = { strokes: [], texts: [], past: [], future: [] };

/**
 * Make `next` the board's strokes, remembering the old list. Same list in, same
 * state out. A real change drops the redo list: once the teacher draws after an
 * undo, the undone strokes are no longer a future of this board.
 */
export function commitStrokes(state: BoardState, next: Stroke[]): BoardState {
  if (next === state.strokes) return state;
  return commitBoth(state, next, state.texts);
}

/** The texts' counterpart of `commitStrokes`: same history, same rules. */
export function commitTexts(state: BoardState, next: TextItem[]): BoardState {
  if (next === state.texts) return state;
  return commitBoth(state, state.strokes, next);
}

function commitBoth(state: BoardState, strokes: Stroke[], texts: TextItem[]): BoardState {
  const past = [...state.past, { strokes: state.strokes, texts: state.texts }];
  return { strokes, texts, past: past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past, future: [] };
}

export function undoBoard(state: BoardState): BoardState {
  if (state.past.length === 0) return state;
  const back = state.past[state.past.length - 1]!;
  return {
    strokes: back.strokes,
    texts: back.texts,
    past: state.past.slice(0, -1),
    future: [{ strokes: state.strokes, texts: state.texts }, ...state.future],
  };
}

/** Step forward again after an undo. Nothing to redo gives the same state back. */
export function redoBoard(state: BoardState): BoardState {
  if (state.future.length === 0) return state;
  const next = state.future[0]!;
  return {
    strokes: next.strokes,
    texts: next.texts,
    past: [...state.past, { strokes: state.strokes, texts: state.texts }],
    future: state.future.slice(1),
  };
}

/** Wipe the board — strokes and texts together, as one commit, so it can be undone. No-op when already empty. */
export function clearBoard(state: BoardState): BoardState {
  return state.strokes.length === 0 && state.texts.length === 0 ? state : commitBoth(state, [], []);
}

/** Is there anything on the page the teacher drew or typed? (Clear, leave-guard and export ask this.) */
export const hasInk = (state: BoardState): boolean => state.strokes.length > 0 || state.texts.length > 0;
export const canUndo = (state: BoardState): boolean => state.past.length > 0;
export const canRedo = (state: BoardState): boolean => state.future.length > 0;

export type BoardBackground = 'blank' | 'grid' | 'axes';
export const BOARD_BACKGROUNDS: readonly BoardBackground[] = ['blank', 'grid', 'axes'];
/** Grid square size in view pixels; one axis unit is one square. */
export const BOARD_STEP = 40;

/**
 * How the paper is drawn at a given page scale (screen pixels per canvas unit).
 * Sizes are in canvas units and are the designed ones at projector size; as the
 * page shrinks (a phone held upright is ~0.3) they grow so that numbers stay
 * 11px, grid lines 1px and axes 2px on screen, and `labelEvery` thins the
 * tick numbers so neighbours stay about 28px apart instead of running
 * together. A bad scale is treated as 1.
 */
export function paperMetrics(scale: number): {
  fontSize: number;
  gridStroke: number;
  axisStroke: number;
  labelEvery: number;
} {
  const k = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return {
    fontSize: Math.max(16, 11 / k),
    gridStroke: Math.max(1.5, 1 / k),
    axisStroke: Math.max(3, 2 / k),
    labelEvery: Math.max(1, Math.ceil(28 / (BOARD_STEP * k) - 1e-9)),
  };
}

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

/** The page's reference size. Paper and stroke widths are drawn in these units. */
export const CANVAS_W = 1280;
export const CANVAS_H = 720;

/** Where the 16:9 page sits inside the screen area, and how big it is. */
export type Stage = { scale: number; width: number; height: number; offsetX: number; offsetY: number };

/**
 * The largest 16:9 rectangle that fits the area, centred. `scale` is its width
 * over `CANVAS_W` (canvas units to pixels). An area with no size yet — before
 * layout — gives an all-zero stage rather than dividing by it.
 */
export function fitCanvas(areaW: number, areaH: number): Stage {
  if (!(areaW > 0) || !(areaH > 0)) return { scale: 0, width: 0, height: 0, offsetX: 0, offsetY: 0 };
  const scale = Math.min(areaW / CANVAS_W, areaH / CANVAS_H);
  const width = CANVAS_W * scale;
  const height = CANVAS_H * scale;
  return { scale, width, height, offsetX: (areaW - width) / 2, offsetY: (areaH - height) / 2 };
}

/** A board is a list of pages; each page owns its paper, its strokes and its undo history. */
export const MAX_PAGES = 20;

export type Page = {
  background: BoardBackground;
  board: BoardState;
  /**
   * A solved problem laid on the page (see `SolutionBlock`). Not ink: it has no
   * undo history, `docHasInk` ignores it, and removing it is not undoable.
   * Absent means none.
   */
  solution?: BoardSolution;
};
export type BoardDoc = { pages: Page[]; current: number };

export const blankPage = (background: BoardBackground = 'blank'): Page => ({ background, board: EMPTY_BOARD });

export const EMPTY_DOC: BoardDoc = { pages: [blankPage()], current: 0 };

export const currentPage = (doc: BoardDoc): Page => doc.pages[doc.current]!;

/** Apply `fn` to the current page. Same page back means the same document back. */
export function updateCurrent(doc: BoardDoc, fn: (page: Page) => Page): BoardDoc {
  const page = currentPage(doc);
  const next = fn(page);
  if (next === page) return doc;
  return { ...doc, pages: doc.pages.map((p, i) => (i === doc.current ? next : p)) };
}

/**
 * Insert a page right after the current one and select it. It has no ink but
 * inherits the current page's paper — someone adding the next problem wants the
 * same grid or axes. At `MAX_PAGES` the same document comes back.
 */
export function addPage(doc: BoardDoc): BoardDoc {
  if (doc.pages.length >= MAX_PAGES) return doc;
  const at = doc.current + 1;
  const page = blankPage(currentPage(doc).background);
  return { pages: [...doc.pages.slice(0, at), page, ...doc.pages.slice(at)], current: at };
}

/** Remove a page (default: the current one). Never the last page; a bad index is ignored. */
export function removePage(doc: BoardDoc, index: number = doc.current): BoardDoc {
  if (doc.pages.length <= 1 || !Number.isInteger(index) || index < 0 || index >= doc.pages.length) return doc;
  const pages = doc.pages.filter((_, i) => i !== index);
  const current = index < doc.current ? doc.current - 1 : doc.current;
  return { pages, current: Math.min(current, pages.length - 1) };
}

/** Select a page, clamped into range. Same page selected means the same document back. */
export function goToPage(doc: BoardDoc, index: number): BoardDoc {
  if (!Number.isInteger(index)) return doc;
  const next = Math.max(0, Math.min(doc.pages.length - 1, index));
  return next === doc.current ? doc : { ...doc, current: next };
}

/** Is there ink or text on ANY page? (What leaving the board asks about.) */
export const docHasInk = (doc: BoardDoc): boolean => doc.pages.some(p => hasInk(p.board));

/** Does ANY page carry typed text? (It is what makes a board file version 3.) */
export const docHasText = (doc: BoardDoc): boolean => doc.pages.some(p => p.board.texts.length > 0);

/** Set (or with `null`, remove) the page's solution. Nothing to change gives the same page back. */
export function withSolution(page: Page, solution: BoardSolution | null): Page {
  if (solution === null) {
    if (page.solution === undefined) return page;
    const { solution: _removed, ...rest } = page;
    return rest;
  }
  return page.solution === solution ? page : { ...page, solution };
}

/** Does ANY page carry a solution? (A solution is content even with no ink.) */
export const docHasSolution = (doc: BoardDoc): boolean => doc.pages.some(p => p.solution !== undefined);

// ----------------------------------------------------------------------------- typed text

/** Font sizes in canvas units. The board's three line widths pick them (same order), so one control serves both tools. */
export const TEXT_SIZES = [40, 56, 84] as const;
export const DEFAULT_TEXT_SIZE: number = TEXT_SIZES[1];
export const MIN_TEXT_SIZE = 8;
export const MAX_TEXT_SIZE = 240;
export const TEXT_LINE_HEIGHT = 1.3;
export const MAX_TEXTS_PER_PAGE = 100;
export const MAX_TEXT_CHARS = 400;
export const MAX_TEXT_LINES = 8;

/** The font size a stroke width stands for; a width that is not one of the three gets the middle size. */
export function textSizeFor(width: number): number {
  const i = STROKE_WIDTHS.indexOf(width as (typeof STROKE_WIDTHS)[number]);
  return TEXT_SIZES[i >= 0 ? i : 1]!;
}

const ARABIC_SCRIPT = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const LATIN_LETTER = /[A-Za-z]/;

/** Does the text read right to left? The first letter of either script decides; digits and punctuation do not. */
export function textIsRtl(text: string): boolean {
  for (const ch of text) {
    if (ARABIC_SCRIPT.test(ch)) return true;
    if (LATIN_LETTER.test(ch)) return false;
  }
  return false;
}

/** Control characters other than a newline, and the bidi override / embedding marks that could reverse what a reader sees. */
// eslint-disable-next-line no-control-regex
export const UNSAFE_TEXT_CHARS = /[\u0000-\u0009\u000B-\u001F\u007F\u202A-\u202E\u2066-\u2069]/;

/**
 * What the dialog's text becomes: line endings unified, unsafe characters dropped, each
 * line trimmed on the right, blank lines at either end gone, then capped at
 * `MAX_TEXT_LINES` lines and `MAX_TEXT_CHARS` characters. Empty in, empty out.
 */
export function cleanText(raw: string): string {
  const lines = raw
    .replace(/\r\n?/g, '\n')
    .replace(new RegExp(UNSAFE_TEXT_CHARS.source, 'g'), '')
    .split('\n')
    .map(l => l.replace(/\s+$/, ''));
  while (lines.length > 0 && lines[0]!.trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === '') lines.pop();
  return lines.slice(0, MAX_TEXT_LINES).join('\n').slice(0, MAX_TEXT_CHARS);
}

export const textLines = (text: string): string[] => text.split('\n');

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * A new item at a spot on the page (canvas units), or null when the text is empty after
 * cleaning. The spot is clamped onto the page, rounded so the saved string is stable, and
 * the item's direction is read from its own text.
 */
export function makeText(x: number, y: number, rawText: string, color: string, size: number): TextItem | null {
  const text = cleanText(rawText);
  if (text === '') return null;
  const px = Math.min(CANVAS_W, Math.max(0, Number.isFinite(x) ? x : 0));
  const py = Math.min(CANVAS_H, Math.max(0, Number.isFinite(y) ? y : 0));
  return { x: round1(px), y: round1(py), size, color, rtl: textIsRtl(text), text };
}

/** Add a text. A full page (`MAX_TEXTS_PER_PAGE`) gives the same state back. */
export function addText(state: BoardState, item: TextItem): BoardState {
  if (state.texts.length >= MAX_TEXTS_PER_PAGE) return state;
  return commitTexts(state, [...state.texts, item]);
}

/** Change the words of one text (its place, colour and size stay; its direction follows the words). Same words give the same state back. */
export function editText(state: BoardState, index: number, rawText: string): BoardState {
  const old = state.texts[index];
  if (!old) return state;
  const text = cleanText(rawText);
  if (text === '') return removeText(state, index);
  if (text === old.text) return state;
  return commitTexts(state, state.texts.map((t, i) => (i === index ? { ...t, text, rtl: textIsRtl(text) } : t)));
}

/** Remove one text. A bad index gives the same state back. */
export function removeText(state: BoardState, index: number): BoardState {
  if (!state.texts[index]) return state;
  return commitTexts(state, state.texts.filter((_, i) => i !== index));
}
