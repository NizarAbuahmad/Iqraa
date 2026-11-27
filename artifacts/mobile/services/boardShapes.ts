/**
 * Straight lines, arrows, rectangles and ellipses for the whiteboard.
 *
 * A shape is not a new kind of object: it is a polyline in the same stored unit as pen ink
 * (fractions of the canvas WIDTH, `services/penInk.ts`). So undo, the eraser, the saved file,
 * the PDF and a shared board already handle it, and an older app opens a board with shapes as
 * a board with ink. The price is that a drawn shape cannot be resized afterwards, only erased
 * and drawn again; selecting ink is a separate feature.
 *
 * Free of react-native so `node --test` can load it.
 */

export const SHAPE_KINDS = ['line', 'arrow', 'rect', 'ellipse'] as const;
export type ShapeKind = (typeof SHAPE_KINDS)[number];

/** A point in stored units. */
export type InkPoint = { x: number; y: number };

/** Below this travel (1% of the page width) a touch was a tap, not a shape. */
export const MIN_SHAPE_EXTENT = 0.01;

const ELLIPSE_SEGMENTS = 48;
/** Arrow barbs: at most this long (stored units), at most this share of the arrow. */
const ARROW_HEAD_MAX = 0.045;
const ARROW_HEAD_SHARE = 0.4;
const ARROW_HEAD_ANGLE = Math.PI / 7;

export function isShapeBigEnough(a: InkPoint, b: InkPoint): boolean {
  return Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) >= MIN_SHAPE_EXTENT;
}

const fmt = (p: InkPoint) => `${Number(p.x.toFixed(5))},${Number(p.y.toFixed(5))}`;

/** The shape whose bounding corners (or ends) are `a` and `b`, as a stroke's `points`. */
export function shapePoints(kind: ShapeKind, a: InkPoint, b: InkPoint): string {
  let path: InkPoint[];
  if (kind === 'line') {
    path = [a, b];
  } else if (kind === 'arrow') {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const head = Math.min(ARROW_HEAD_MAX, len * ARROW_HEAD_SHARE);
    const back = Math.atan2(-dy, -dx); // from the tip, back along the shaft
    const barb = (turn: number): InkPoint => ({ x: b.x + head * Math.cos(back + turn), y: b.y + head * Math.sin(back + turn) });
    path = [a, b, barb(ARROW_HEAD_ANGLE), b, barb(-ARROW_HEAD_ANGLE)];
  } else if (kind === 'rect') {
    path = [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }, a];
  } else {
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const rx = (b.x - a.x) / 2;
    const ry = (b.y - a.y) / 2;
    path = [];
    for (let i = 0; i < ELLIPSE_SEGMENTS; i++) {
      const t = (i / ELLIPSE_SEGMENTS) * 2 * Math.PI;
      path.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) });
    }
    path.push(path[0]!);
  }
  return path.map(fmt).join(' ');
}
