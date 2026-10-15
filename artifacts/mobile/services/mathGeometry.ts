/**
 * The geometry sketchpad's model. Pure and free of react-native, so every number
 * a student is shown can be tested.
 *
 * A scene is points (labelled A–Z) and the shapes drawn through them: segments,
 * polygons of 3–8 vertices and circles (a centre and a point on the circle). A
 * shape names its points by id, so dragging a point moves every shape that uses
 * it and deleting a point deletes those shapes.
 *
 * Fails closed. A self-intersecting polygon has no honest area or interior
 * angles, so it gets a named refusal, not the shoelace number (which silently
 * lies there). Collinear points have area 0 and no angles; two vertices on the
 * same spot make the angle there fail as «coincident». Lengths are in grid
 * units: the grid is the ruler. Interior angles are measured properly, so a
 * concave corner is its reflex 270°, not its 90° mirror.
 *
 * The circle's numbers are the book's: centre (a, b), and `r²` for the equation
 * (x − a)² + (y − b)² = r².
 */
import { niceStep, toPx, toWorld, type Point, type Viewport } from './mathViewport.ts';

export const MAX_POINTS = 26;
export const MAX_SHAPES = 40;
const MAX_VERTICES = 8;
const MAX_HISTORY = 50;

export type GPoint = { id: string; label: string; x: number; y: number };

export type Shape =
  | { id: string; kind: 'segment'; a: string; b: string }
  | { id: string; kind: 'polygon'; ids: string[] }
  | { id: string; kind: 'circle'; center: string; through: string };

export type Scene = { points: GPoint[]; shapes: Shape[]; nextId: number };

export function emptyScene(): Scene {
  return { points: [], shapes: [], nextId: 1 };
}

// ---------------------------------------------------------------------------
// Snapping

/** Round to the step, without float noise: 0.3, not 0.30000000000000004. */
export function snapValue(v: number, step: number): number {
  const r = Number((Math.round(v / step) * step).toPrecision(12));
  return r === 0 ? 0 : r;
}

/** The grid step a point snaps to at this zoom: about 14 px between snap positions. */
export function snapStep(vp: Viewport): number {
  return niceStep(vp.sx, 14);
}

// ---------------------------------------------------------------------------
// Editing

export type AddFailure =
  | 'full'
  | 'same-point'
  | 'duplicate'
  | 'too-few'
  | 'too-many'
  | 'zero-radius'
  | 'unknown-point';

export type AddResult = { scene: Scene; id: string | null; reason?: AddFailure };
export type PointResult = AddResult & { created: boolean };

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const pointById = (scene: Scene, id: string): GPoint | undefined => scene.points.find(p => p.id === id);

export function addPoint(
  scene: Scene,
  x: number,
  y: number,
  opts: { snapStep?: number; mergeRadius?: number } = {},
): PointResult {
  const px = opts.snapStep ? snapValue(x, opts.snapStep) : x;
  const py = opts.snapStep ? snapValue(y, opts.snapStep) : y;

  const radius = opts.mergeRadius ?? 0;
  let nearest: GPoint | null = null;
  let best = Infinity;
  // No radius means no merging at all: callers building a scene by coordinates get what they asked for.
  for (const p of radius > 0 ? scene.points : []) {
    const d = Math.hypot(p.x - px, p.y - py);
    if (d <= radius && d < best) {
      best = d;
      nearest = p;
    }
  }
  if (nearest) return { scene, id: nearest.id, created: false };
  if (scene.points.length >= MAX_POINTS) return { scene, id: null, created: false, reason: 'full' };

  const used = new Set(scene.points.map(p => p.label));
  const label = [...LETTERS].find(l => !used.has(l)) as string;
  const id = `p${scene.nextId}`;
  return {
    scene: { ...scene, points: [...scene.points, { id, label, x: px, y: py }], nextId: scene.nextId + 1 },
    id,
    created: true,
  };
}

export function movePoint(scene: Scene, id: string, x: number, y: number, opts: { snapStep?: number } = {}): Scene {
  if (!pointById(scene, id)) return scene;
  const nx = opts.snapStep ? snapValue(x, opts.snapStep) : x;
  const ny = opts.snapStep ? snapValue(y, opts.snapStep) : y;
  return { ...scene, points: scene.points.map(p => (p.id === id ? { ...p, x: nx, y: ny } : p)) };
}

function usesPoint(shape: Shape, id: string): boolean {
  switch (shape.kind) {
    case 'segment':
      return shape.a === id || shape.b === id;
    case 'polygon':
      return shape.ids.includes(id);
    case 'circle':
      return shape.center === id || shape.through === id;
  }
}

/** Deleting a point deletes every shape that uses it, and only those. */
export function deletePoint(scene: Scene, id: string): Scene {
  return {
    ...scene,
    points: scene.points.filter(p => p.id !== id),
    shapes: scene.shapes.filter(s => !usesPoint(s, id)),
  };
}

export function deleteShape(scene: Scene, id: string): Scene {
  return { ...scene, shapes: scene.shapes.filter(s => s.id !== id) };
}

const fail = (scene: Scene, reason: AddFailure): AddResult => ({ scene, id: null, reason });

function addShape(scene: Scene, make: (id: string) => Shape): AddResult {
  if (scene.shapes.length >= MAX_SHAPES) return fail(scene, 'full');
  const id = `s${scene.nextId}`;
  return { scene: { ...scene, shapes: [...scene.shapes, make(id)], nextId: scene.nextId + 1 }, id };
}

export function addSegment(scene: Scene, a: string, b: string): AddResult {
  if (!pointById(scene, a) || !pointById(scene, b)) return fail(scene, 'unknown-point');
  if (a === b) return fail(scene, 'same-point');
  const twice = scene.shapes.some(s => s.kind === 'segment' && ((s.a === a && s.b === b) || (s.a === b && s.b === a)));
  if (twice) return fail(scene, 'duplicate');
  return addShape(scene, id => ({ id, kind: 'segment', a, b }));
}

export function addPolygon(scene: Scene, ids: string[]): AddResult {
  if (ids.some(id => !pointById(scene, id))) return fail(scene, 'unknown-point');
  if (new Set(ids).size !== ids.length) return fail(scene, 'same-point');
  if (ids.length < 3) return fail(scene, 'too-few');
  if (ids.length > MAX_VERTICES) return fail(scene, 'too-many');
  return addShape(scene, id => ({ id, kind: 'polygon', ids: [...ids] }));
}

export function addCircle(scene: Scene, center: string, through: string): AddResult {
  const c = pointById(scene, center);
  const t = pointById(scene, through);
  if (!c || !t) return fail(scene, 'unknown-point');
  if (center === through) return fail(scene, 'same-point');
  if (Math.hypot(c.x - t.x, c.y - t.y) < 1e-12) return fail(scene, 'zero-radius');
  return addShape(scene, id => ({ id, kind: 'circle', center, through }));
}

/** «A», «AB», «ABC»: a point's label, or the labels of a shape's points in order. */
export function labelOf(scene: Scene, id: string): string {
  const p = pointById(scene, id);
  if (p) return p.label;
  const s = scene.shapes.find(x => x.id === id);
  if (!s) return '';
  const l = (pid: string) => pointById(scene, pid)?.label ?? '';
  switch (s.kind) {
    case 'segment':
      return l(s.a) + l(s.b);
    case 'polygon':
      return s.ids.map(l).join('');
    case 'circle':
      return l(s.center);
  }
}

// ---------------------------------------------------------------------------
// Hit testing (in pixels, so a fingertip is the unit that matters)

/** The nearest point within `radius` px of the touch, or null. */
export function hitTestPoint(scene: Scene, vp: Viewport, px: number, py: number, radius = 22): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const p of scene.points) {
    const q = toPx(vp, p.x, p.y);
    const d = Math.hypot(q.x - px, q.y - py);
    if (d <= radius && d < bestD) {
      bestD = d;
      best = p.id;
    }
  }
  return best;
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** The shape whose outline is nearest the touch, within `tol` px. The inside of a polygon or circle is not a hit. */
export function hitTestShape(scene: Scene, vp: Viewport, px: number, py: number, tol = 12): string | null {
  const touch = { x: px, y: py };
  const at = (id: string): Point => {
    const p = pointById(scene, id) as GPoint;
    return toPx(vp, p.x, p.y);
  };
  let best: string | null = null;
  let bestD = Infinity;
  for (const s of scene.shapes) {
    let d = Infinity;
    if (s.kind === 'segment') {
      d = distToSegment(touch, at(s.a), at(s.b));
    } else if (s.kind === 'polygon') {
      const pts = s.ids.map(at);
      pts.forEach((a, i) => {
        d = Math.min(d, distToSegment(touch, a, pts[(i + 1) % pts.length]));
      });
    } else {
      const c = at(s.center);
      const t = at(s.through);
      d = Math.abs(Math.hypot(touch.x - c.x, touch.y - c.y) - Math.hypot(t.x - c.x, t.y - c.y));
    }
    if (d <= tol && d < bestD) {
      bestD = d;
      best = s.id;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// History

export type History = { past: Scene[]; present: Scene; future: Scene[] };

export function initialHistory(): History {
  return { past: [], present: emptyScene(), future: [] };
}

/** Record `scene` as a new step. The same scene is not a step. */
export function commit(h: History, scene: Scene): History {
  if (scene === h.present) return h;
  return { past: [...h.past, h.present].slice(-MAX_HISTORY), present: scene, future: [] };
}

export function undo(h: History): History {
  if (h.past.length === 0) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
}

export function redo(h: History): History {
  if (h.future.length === 0) return h;
  return { past: [...h.past, h.present].slice(-MAX_HISTORY), present: h.future[0], future: h.future.slice(1) };
}

/** Change the scene without a step: the live frames of a drag. */
export function replacePresent(h: History, scene: Scene): History {
  return { ...h, present: scene };
}

/** End a drag: one step, recorded against where the drag began. */
export function commitFrom(h: History, before: Scene): History {
  if (h.present === before) return h;
  return { past: [...h.past, before].slice(-MAX_HISTORY), present: h.present, future: [] };
}

// ---------------------------------------------------------------------------
// Measuring

export type Measured = { ok: true; value: number } | { ok: false; reason: 'self-intersecting' | 'coincident' | 'degenerate' };

export type SegmentMeasure = { kind: 'segment'; id: string; name: string; length: number };
export type AngleMeasure = { vertex: string; degrees: Measured; right: boolean };
export type TriangleClass = {
  bySides: 'equilateral' | 'isosceles' | 'scalene';
  byAngles: 'acute' | 'right' | 'obtuse';
};
export type PolygonMeasure = {
  kind: 'polygon';
  id: string;
  name: string;
  perimeter: number;
  area: Measured;
  angles: AngleMeasure[];
  triangle: TriangleClass | null;
};
export type CircleMeasure = {
  kind: 'circle';
  id: string;
  name: string;
  radius: number;
  circumference: number;
  area: number;
  /** Centre (a, b) and r², for (x − a)² + (y − b)² = r². */
  a: number;
  b: number;
  r2: number;
};
export type Measure = SegmentMeasure | PolygonMeasure | CircleMeasure;

const RIGHT_TOLERANCE_DEG = 0.05;

const cross = (o: Point, a: Point, b: Point): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

function onSegment(a: Point, b: Point, c: Point, eps: number): boolean {
  return (
    Math.min(a.x, b.x) - eps <= c.x && c.x <= Math.max(a.x, b.x) + eps &&
    Math.min(a.y, b.y) - eps <= c.y && c.y <= Math.max(a.y, b.y) + eps
  );
}

/** Do the closed segments p1p2 and p3p4 share a point (touching and overlapping count)? */
function segmentsMeet(p1: Point, p2: Point, p3: Point, p4: Point, eps: number): boolean {
  const sign = (v: number) => (Math.abs(v) <= eps ? 0 : v > 0 ? 1 : -1);
  const d1 = sign(cross(p3, p4, p1));
  const d2 = sign(cross(p3, p4, p2));
  const d3 = sign(cross(p1, p2, p3));
  const d4 = sign(cross(p1, p2, p4));
  if (d1 !== d2 && d3 !== d4 && d1 * d2 <= 0 && d3 * d4 <= 0) return true;
  if (d1 === 0 && onSegment(p3, p4, p1, eps)) return true;
  if (d2 === 0 && onSegment(p3, p4, p2, eps)) return true;
  if (d3 === 0 && onSegment(p1, p2, p3, eps)) return true;
  if (d4 === 0 && onSegment(p1, p2, p4, eps)) return true;
  return false;
}

function selfIntersects(pts: Point[], eps: number): boolean {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue; // neighbours share a corner by design
      if (segmentsMeet(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n], eps)) return true;
    }
  }
  return false;
}

const samePlace = (a: Point, b: Point): boolean => Math.hypot(a.x - b.x, a.y - b.y) < 1e-9;

function measurePolygon(scene: Scene, s: Extract<Shape, { kind: 'polygon' }>): PolygonMeasure {
  const verts = s.ids.map(id => pointById(scene, id) as GPoint);
  const n = verts.length;
  const perimeter = verts.reduce((sum, v, i) => sum + Math.hypot(v.x - verts[(i + 1) % n].x, v.y - verts[(i + 1) % n].y), 0);
  const base = { kind: 'polygon' as const, id: s.id, name: verts.map(v => v.label).join(''), perimeter };

  // Corners on the same spot are collapsed for area and crossing; their own angles fail.
  const coincidentAt = verts.map((v, i) => samePlace(v, verts[(i + n - 1) % n]) || samePlace(v, verts[(i + 1) % n]));
  const clean = verts.filter((v, i) => !samePlace(v, verts[(i + n - 1) % n]) || i === 0 && !samePlace(v, verts[n - 1]));
  const scale = Math.max(1, ...verts.map(v => Math.max(Math.abs(v.x), Math.abs(v.y))));
  const eps = 1e-9 * scale * scale;

  const refuse = (reason: 'self-intersecting' | 'degenerate'): PolygonMeasure => ({
    ...base,
    area: reason === 'degenerate' ? { ok: true, value: 0 } : { ok: false, reason },
    angles: verts.map(v => ({ vertex: v.label, degrees: { ok: false, reason }, right: false })),
    triangle: null,
  });

  if (clean.length >= 4 && selfIntersects(clean, eps)) return refuse('self-intersecting');
  const area2 = clean.reduce((sum, v, i) => sum + (v.x * clean[(i + 1) % clean.length].y - clean[(i + 1) % clean.length].x * v.y), 0);
  if (clean.length < 3 || Math.abs(area2) <= eps) return refuse('degenerate');

  const orient = area2 > 0 ? 1 : -1;
  const angles: AngleMeasure[] = verts.map((v, i) => {
    if (coincidentAt[i]) return { vertex: v.label, degrees: { ok: false, reason: 'coincident' }, right: false };
    const p = verts[(i + n - 1) % n];
    const q = verts[(i + 1) % n];
    const e1 = { x: v.x - p.x, y: v.y - p.y };
    const e2 = { x: q.x - v.x, y: q.y - v.y };
    const turn = Math.atan2(e1.x * e2.y - e1.y * e2.x, e1.x * e2.x + e1.y * e2.y);
    let interior = Math.PI - orient * turn;
    if (interior <= 0) interior += 2 * Math.PI;
    const deg = (interior * 180) / Math.PI;
    return { vertex: v.label, degrees: { ok: true, value: deg }, right: Math.abs(deg - 90) < RIGHT_TOLERANCE_DEG };
  });

  let triangle: TriangleClass | null = null;
  if (n === 3 && !coincidentAt.some(Boolean)) {
    const [a, b, c] = verts;
    const sides = [Math.hypot(b.x - c.x, b.y - c.y), Math.hypot(a.x - c.x, a.y - c.y), Math.hypot(a.x - b.x, a.y - b.y)];
    const longest = Math.max(...sides);
    const same = (x: number, y: number) => Math.abs(x - y) <= 1e-9 * longest;
    const equal = [same(sides[0], sides[1]), same(sides[1], sides[2]), same(sides[0], sides[2])].filter(Boolean).length;
    const biggest = Math.max(...angles.map(x => (x.degrees.ok ? x.degrees.value : 0)));
    triangle = {
      bySides: equal === 3 ? 'equilateral' : equal >= 1 ? 'isosceles' : 'scalene',
      byAngles: Math.abs(biggest - 90) < RIGHT_TOLERANCE_DEG ? 'right' : biggest > 90 ? 'obtuse' : 'acute',
    };
  }

  return { ...base, area: { ok: true, value: Math.abs(area2) / 2 }, angles, triangle };
}

/** Every shape's numbers, in the order the shapes were drawn. */
export function measure(scene: Scene): Measure[] {
  return scene.shapes.map((s): Measure => {
    if (s.kind === 'segment') {
      const a = pointById(scene, s.a) as GPoint;
      const b = pointById(scene, s.b) as GPoint;
      return { kind: 'segment', id: s.id, name: a.label + b.label, length: Math.hypot(a.x - b.x, a.y - b.y) };
    }
    if (s.kind === 'polygon') return measurePolygon(scene, s);
    const c = pointById(scene, s.center) as GPoint;
    const t = pointById(scene, s.through) as GPoint;
    const dx = t.x - c.x;
    const dy = t.y - c.y;
    const r2 = dx * dx + dy * dy;
    const radius = Math.sqrt(r2);
    return {
      kind: 'circle',
      id: s.id,
      name: c.label,
      radius,
      circumference: 2 * Math.PI * radius,
      area: Math.PI * r2,
      a: c.x,
      b: c.y,
      r2,
    };
  });
}

const clean = (n: number): number => {
  const r = Number(n.toFixed(4));
  return r === 0 ? 0 : r;
};

function squaredTerm(v: string, centre: number): string {
  const c = clean(centre);
  if (c === 0) return `${v}²`;
  return c > 0 ? `(${v} − ${c})²` : `(${v} + ${-c})²`;
}

/** «(x − 2)² + (y + 1)² = 25», the way the book writes it; a centre on an axis collapses that term. */
export function circleEquationText(a: number, b: number, r2: number): string {
  return `${squaredTerm('x', a)} + ${squaredTerm('y', b)} = ${clean(r2)}`;
}

// ---------------------------------------------------------------------------
// What a tap does

export type SketchTool = 'move' | 'point' | 'segment' | 'polygon' | 'circle' | 'delete';

export type TapResult = { scene: Scene; pending: string[]; notice?: 'full' };

/** The point under a tap, or a new one there (snapped on request). */
function resolve(scene: Scene, vp: Viewport, px: number, py: number, snap: boolean): PointResult {
  const hit = hitTestPoint(scene, vp, px, py);
  if (hit) return { scene, id: hit, created: false };
  const w = toWorld(vp, px, py);
  // A tiny merge radius keeps a snapped tap from stacking on a point that is exactly there.
  return addPoint(scene, w.x, w.y, { snapStep: snap ? snapStep(vp) : undefined, mergeRadius: 1e-9 });
}

export function sketchTap(
  tool: SketchTool,
  pending: string[],
  scene: Scene,
  vp: Viewport,
  px: number,
  py: number,
  opts: { snap: boolean },
): TapResult {
  if (tool === 'move') return { scene, pending };

  if (tool === 'delete') {
    const hit = hitTestPoint(scene, vp, px, py);
    if (hit) return { scene: deletePoint(scene, hit), pending: [] };
    const shape = hitTestShape(scene, vp, px, py);
    return shape ? { scene: deleteShape(scene, shape), pending: [] } : { scene, pending };
  }

  const r = resolve(scene, vp, px, py, opts.snap);
  if (r.id === null) return { scene, pending, notice: 'full' };
  const id = r.id;
  const next = r.scene;

  if (tool === 'point') return { scene: next, pending: [] };

  if (tool === 'segment' || tool === 'circle') {
    if (pending.length === 0) return { scene: next, pending: [id] };
    if (id === pending[0]) return { scene: next, pending };
    const made = tool === 'segment' ? addSegment(next, pending[0], id) : addCircle(next, pending[0], id);
    return { scene: made.scene, pending: [] };
  }

  // polygon
  if (pending.length >= 3 && id === pending[0]) return closePolygon(next, pending);
  if (pending.includes(id) || pending.length >= MAX_VERTICES) return { scene: next, pending };
  return { scene: next, pending: [...pending, id] };
}

/** The ✓ button: close the polygon being drawn, if it has at least three corners. */
export function closePolygon(scene: Scene, pending: string[]): TapResult {
  const made = addPolygon(scene, pending);
  return made.id ? { scene: made.scene, pending: [] } : { scene, pending };
}
