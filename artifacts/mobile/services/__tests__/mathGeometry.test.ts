import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_POINTS,
  addCircle,
  addPoint,
  addPolygon,
  addSegment,
  circleEquationText,
  closePolygon,
  commitFrom,
  deletePoint,
  deleteShape,
  emptyScene,
  hitTestPoint,
  hitTestShape,
  initialHistory,
  labelOf,
  measure,
  movePoint,
  redo,
  replacePresent,
  commit,
  sketchTap,
  snapStep,
  snapValue,
  undo,
  type CircleMeasure,
  type PolygonMeasure,
  type Scene,
  type SegmentMeasure,
} from '../mathGeometry.ts';
import { makeViewport, toPx, zoomAt } from '../mathViewport.ts';

function close(actual: number, expected: number, tol = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} != ${expected}`);
}

/** A scene with these points (no snapping or merging) and their ids. */
function withPoints(coords: [number, number][]): { scene: Scene; ids: string[] } {
  let scene = emptyScene();
  const ids: string[] = [];
  for (const [x, y] of coords) {
    const r = addPoint(scene, x, y);
    assert.ok(r.id, 'point was not added');
    scene = r.scene;
    ids.push(r.id);
  }
  return { scene, ids };
}
function polygon(coords: [number, number][]): { scene: Scene; id: string } {
  const { scene, ids } = withPoints(coords);
  const r = addPolygon(scene, ids);
  assert.ok(r.id, `polygon refused: ${r.reason}`);
  return { scene: r.scene, id: r.id };
}
const polyMeasure = (scene: Scene): PolygonMeasure => {
  const m = measure(scene).find((x): x is PolygonMeasure => x.kind === 'polygon');
  assert.ok(m);
  return m;
};
const degrees = (m: PolygonMeasure): number[] =>
  m.angles.map(a => {
    assert.ok(a.degrees.ok, `angle at ${a.vertex} failed`);
    return a.degrees.value;
  });

describe('snapping', () => {
  it('snapValue rounds to the step without float noise', () => {
    assert.equal(snapValue(2.6, 1), 3);
    assert.equal(snapValue(0.34, 0.1), 0.3);
    assert.equal(snapValue(-0.26, 0.5), -0.5);
    assert.equal(snapValue(0.3 + 1e-12, 0.1), 0.3);
  });
  it('snapStep follows the zoom: one unit at the standard view, finer when zoomed in', () => {
    const vp = makeViewport(360, 360, 'standard');
    assert.equal(snapStep(vp), 1);
    assert.equal(snapStep(zoomAt(vp, 5.5, 180, 180)), 0.2);
    assert.ok(snapStep(zoomAt(vp, 0.1, 180, 180)) >= 5);
  });
});

describe('addPoint', () => {
  it('labels the points A, B, C in order', () => {
    const { scene } = withPoints([[0, 0], [1, 0], [2, 0]]);
    assert.deepEqual(scene.points.map(p => p.label), ['A', 'B', 'C']);
  });
  it('snaps to the step when asked', () => {
    const r = addPoint(emptyScene(), 2.6, -1.4, { snapStep: 1 });
    assert.deepEqual([r.scene.points[0].x, r.scene.points[0].y], [3, -1]);
  });
  it('reuses an existing point within the merge radius instead of stacking another', () => {
    const first = addPoint(emptyScene(), 1, 1);
    const again = addPoint(first.scene, 1.05, 0.98, { mergeRadius: 0.2 });
    assert.equal(again.id, first.id);
    assert.equal(again.created, false);
    assert.equal(again.scene, first.scene);
    const far = addPoint(first.scene, 3, 3, { mergeRadius: 0.2 });
    assert.equal(far.created, true);
    assert.equal(far.scene.points.length, 2);
  });
  it('reuses the first free letter after a deletion', () => {
    let { scene, ids } = withPoints([[0, 0], [1, 0], [2, 0]]);
    scene = deletePoint(scene, ids[1]);
    const r = addPoint(scene, 5, 5);
    assert.equal(r.scene.points.find(p => p.id === r.id)?.label, 'B');
  });
  it('stops at 26 points and says so', () => {
    let scene = emptyScene();
    for (let i = 0; i < MAX_POINTS; i++) scene = addPoint(scene, i, 0).scene;
    const r = addPoint(scene, 100, 100);
    assert.equal(r.id, null);
    assert.equal(r.reason, 'full');
    assert.equal(r.scene.points.length, MAX_POINTS);
  });
});

describe('movePoint and deletePoint', () => {
  it('movePoint moves one point, snapping if asked, leaving the rest', () => {
    const { scene, ids } = withPoints([[0, 0], [4, 0]]);
    const moved = movePoint(scene, ids[1], 4.4, 2.6, { snapStep: 1 });
    assert.deepEqual([moved.points[1].x, moved.points[1].y], [4, 3]);
    assert.deepEqual([moved.points[0].x, moved.points[0].y], [0, 0]);
  });
  it('moving an unknown point changes nothing', () => {
    const { scene } = withPoints([[0, 0]]);
    assert.equal(movePoint(scene, 'nope', 1, 1), scene);
  });
  it('deleting a point deletes every shape that uses it, and only those', () => {
    const { scene: s0, ids } = withPoints([[0, 0], [4, 0], [4, 3], [10, 10], [12, 10]]);
    let scene = addPolygon(s0, [ids[0], ids[1], ids[2]]).scene;
    scene = addSegment(scene, ids[3], ids[4]).scene;
    scene = addCircle(scene, ids[3], ids[4]).scene;
    const after = deletePoint(scene, ids[1]);
    assert.equal(after.points.length, 4);
    assert.deepEqual(after.shapes.map(s => s.kind).sort(), ['circle', 'segment']);
  });
});

describe('shapes', () => {
  const { scene, ids } = withPoints([[0, 0], [4, 0], [4, 3], [0, 3]]);
  it('a segment needs two different points and is not added twice, in either order', () => {
    assert.equal(addSegment(scene, ids[0], ids[0]).reason, 'same-point');
    const once = addSegment(scene, ids[0], ids[1]);
    assert.ok(once.id);
    assert.equal(addSegment(once.scene, ids[0], ids[1]).reason, 'duplicate');
    assert.equal(addSegment(once.scene, ids[1], ids[0]).reason, 'duplicate');
    assert.equal(addSegment(scene, ids[0], 'nope').reason, 'unknown-point');
  });
  it('a polygon needs 3 to 8 distinct points', () => {
    assert.equal(addPolygon(scene, [ids[0], ids[1]]).reason, 'too-few');
    assert.equal(addPolygon(scene, [ids[0], ids[1], ids[1]]).reason, 'same-point');
    assert.ok(addPolygon(scene, ids).id);
    let big = emptyScene();
    const many: string[] = [];
    for (let i = 0; i < 9; i++) {
      const r = addPoint(big, i, i * i);
      big = r.scene;
      many.push(r.id!);
    }
    assert.equal(addPolygon(big, many).reason, 'too-many');
  });
  it('a circle needs a centre and a different point to pass through', () => {
    assert.equal(addCircle(scene, ids[0], ids[0]).reason, 'same-point');
    const coincident = addPoint(scene, 0, 0);
    assert.equal(addCircle(coincident.scene, ids[0], coincident.id!).reason, 'zero-radius');
    assert.ok(addCircle(scene, ids[0], ids[1]).id);
  });
  it('deleteShape removes just that shape and keeps its points', () => {
    const r = addSegment(scene, ids[0], ids[1]);
    const after = deleteShape(r.scene, r.id!);
    assert.equal(after.shapes.length, 0);
    assert.equal(after.points.length, 4);
  });
  it('labelOf names a point, a segment, a polygon in order', () => {
    const seg = addSegment(scene, ids[1], ids[2]);
    assert.equal(labelOf(seg.scene, seg.scene.shapes[0].id), 'BC');
    const poly = addPolygon(scene, ids);
    assert.equal(labelOf(poly.scene, poly.scene.shapes[0].id), 'ABCD');
    assert.equal(labelOf(poly.scene, ids[2]), 'C');
  });
});

describe('hit testing', () => {
  const vp = makeViewport(360, 360, 'standard');
  it('picks the nearest point within the radius, and nothing beyond it', () => {
    const { scene, ids } = withPoints([[0, 0], [3, 0]]);
    const p = toPx(vp, 3, 0);
    assert.equal(hitTestPoint(scene, vp, p.x + 10, p.y - 8), ids[1]);
    assert.equal(hitTestPoint(scene, vp, p.x + 60, p.y), null);
    assert.equal(hitTestPoint(scene, vp, p.x + 22, p.y), ids[1]);
    assert.equal(hitTestPoint(scene, vp, p.x + 23, p.y), null);
  });
  it('of two overlapping candidates takes the closer', () => {
    const { scene, ids } = withPoints([[0, 0], [0.5, 0]]);
    const p = toPx(vp, 0.4, 0);
    assert.equal(hitTestPoint(scene, vp, p.x, p.y), ids[1]);
  });
  it('finds a segment, a polygon edge and a circle by their outline, not their inside', () => {
    const { scene: s0, ids } = withPoints([[0, 0], [6, 0], [6, 4], [0, 4], [-8, -8], [-5, -8]]);
    const seg = addSegment(s0, ids[4], ids[5]);
    const poly = addPolygon(seg.scene, [ids[0], ids[1], ids[2], ids[3]]);
    const circle = addCircle(poly.scene, ids[0], ids[1]);
    const scene = circle.scene;
    const onSeg = toPx(vp, -6.5, -8);
    assert.equal(hitTestShape(scene, vp, onSeg.x, onSeg.y), seg.id);
    const onEdge = toPx(vp, 6, 2);
    assert.equal(hitTestShape(scene, vp, onEdge.x, onEdge.y), poly.id);
    const onCircle = toPx(vp, 0, 6);
    assert.equal(hitTestShape(scene, vp, onCircle.x, onCircle.y), circle.id);
    const inside = toPx(vp, 3, 2);
    assert.equal(hitTestShape(scene, vp, inside.x, inside.y), null);
  });
});

describe('history', () => {
  it('undo and redo walk the scenes, and a new action clears the redo branch', () => {
    let h = initialHistory();
    const s0 = h.present;
    const s1 = addPoint(s0, 1, 1).scene;
    const s2 = addPoint(s1, 2, 2).scene;
    h = commit(h, s1);
    h = commit(h, s2);
    assert.equal(h.present, s2);
    h = undo(h);
    assert.equal(h.present, s1);
    h = undo(h);
    assert.equal(h.present, s0);
    assert.equal(undo(h), h);
    h = redo(h);
    assert.equal(h.present, s1);
    h = commit(h, addPoint(s1, 9, 9).scene);
    assert.equal(h.future.length, 0);
    assert.equal(redo(h), h);
  });
  it('an unchanged scene is not a new step', () => {
    const h = initialHistory();
    assert.equal(commit(h, h.present), h);
  });
  it('keeps at most 50 steps', () => {
    let h = initialHistory();
    for (let i = 0; i < 80; i++) h = commit(h, { ...h.present, nextId: 100 + i });
    assert.equal(h.past.length, 50);
    assert.equal(h.present.nextId, 179);
  });
  it('a drag is one step: replacePresent is live, commitFrom records where it began', () => {
    const base = addPoint(emptyScene(), 0, 0);
    let h = commit(initialHistory(), base.scene);
    const before = h.present;
    h = replacePresent(h, movePoint(h.present, base.id!, 1, 0));
    h = replacePresent(h, movePoint(h.present, base.id!, 2, 0));
    assert.equal(h.past.length, 1);
    h = commitFrom(h, before);
    assert.equal(h.past.length, 2);
    h = undo(h);
    assert.equal(h.present.points[0].x, 0);
  });
});

describe('measure: a polygon', () => {
  it('the 3-4-5 triangle: perimeter, area and angles', () => {
    const { scene } = polygon([[0, 0], [4, 0], [4, 3]]);
    const m = polyMeasure(scene);
    close(m.perimeter, 12);
    assert.deepEqual(m.area, { ok: true, value: 6 });
    const a = degrees(m);
    close(a[0], 36.8698976, 1e-6);
    close(a[1], 90, 1e-9);
    close(a[2], 53.1301024, 1e-6);
    close(a[0] + a[1] + a[2], 180, 1e-9);
    assert.equal(m.angles[1].right, true);
    assert.equal(m.angles[0].right, false);
    assert.equal(m.name, 'ABC');
  });
  it('a unit square has four right angles and area 1', () => {
    const m = polyMeasure(polygon([[0, 0], [1, 0], [1, 1], [0, 1]]).scene);
    assert.deepEqual(m.area, { ok: true, value: 1 });
    assert.deepEqual(degrees(m).map(d => Math.round(d)), [90, 90, 90, 90]);
    assert.ok(m.angles.every(a => a.right));
    close(m.perimeter, 4);
  });
  it('the angle sum of any simple polygon is (n − 2) × 180, whichever way it is drawn', () => {
    for (const coords of [
      [[0, 0], [5, 1], [6, 5], [1, 7], [-2, 3]],
      [[-2, 3], [1, 7], [6, 5], [5, 1], [0, 0]],
    ] as [number, number][][]) {
      const sum = degrees(polyMeasure(polygon(coords).scene)).reduce((a, b) => a + b, 0);
      close(sum, 540, 1e-6);
    }
  });
  it('a concave polygon has a reflex interior angle, not its 90° mirror image', () => {
    // An L: the inner corner at (1, 1) is 270° inside.
    const m = polyMeasure(polygon([[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2]]).scene);
    const a = degrees(m);
    assert.ok(a.some(d => Math.abs(d - 270) < 1e-6), a.join(','));
    close(a.reduce((x, y) => x + y, 0), 720, 1e-6);
    assert.deepEqual(m.area, { ok: true, value: 3 });
  });
  it('a self-intersecting polygon refuses an area and angles instead of making them up', () => {
    const m = polyMeasure(polygon([[0, 0], [2, 2], [2, 0], [0, 2]]).scene);
    assert.deepEqual(m.area, { ok: false, reason: 'self-intersecting' });
    assert.ok(m.angles.every(a => !a.degrees.ok && a.degrees.reason === 'self-intersecting'));
    assert.ok(m.perimeter > 0);
  });
  it('a polygon whose corner touches another edge counts as self-intersecting', () => {
    const m = polyMeasure(polygon([[0, 0], [4, 0], [4, 4], [2, 0], [0, 4]]).scene);
    assert.deepEqual(m.area, { ok: false, reason: 'self-intersecting' });
  });
  it('collinear points have area 0 and no angles', () => {
    const m = polyMeasure(polygon([[0, 0], [1, 1], [2, 2]]).scene);
    assert.deepEqual(m.area, { ok: true, value: 0 });
    assert.ok(m.angles.every(a => !a.degrees.ok && a.degrees.reason === 'degenerate'));
    assert.equal(m.triangle, null);
  });
  it('two vertices on the same spot make the angle there fail closed', () => {
    const m = polyMeasure(polygon([[0, 0], [0, 0], [4, 0], [4, 3]]).scene);
    assert.ok(m.angles.some(a => !a.degrees.ok && a.degrees.reason === 'coincident'));
  });
  it('a clockwise polygon measures the same as the counter-clockwise one', () => {
    const ccw = polyMeasure(polygon([[0, 0], [4, 0], [4, 3]]).scene);
    const cw = polyMeasure(polygon([[0, 0], [4, 3], [4, 0]]).scene);
    assert.deepEqual(cw.area, ccw.area);
    close(degrees(cw).reduce((a, b) => a + b, 0), 180);
  });
});

describe('measure: triangle classification', () => {
  const cls = (coords: [number, number][]) => polyMeasure(polygon(coords).scene).triangle;
  it('by sides and by angles', () => {
    assert.deepEqual(cls([[0, 0], [4, 0], [4, 3]]), { bySides: 'scalene', byAngles: 'right' });
    assert.deepEqual(cls([[0, 0], [2, 0], [1, Math.sqrt(3)]]), { bySides: 'equilateral', byAngles: 'acute' });
    assert.deepEqual(cls([[0, 0], [4, 0], [2, 3]]), { bySides: 'isosceles', byAngles: 'acute' });
    assert.deepEqual(cls([[0, 0], [6, 0], [3, 1]]), { bySides: 'isosceles', byAngles: 'obtuse' });
    assert.deepEqual(cls([[0, 0], [1, 0], [0, 1]]), { bySides: 'isosceles', byAngles: 'right' });
  });
  it('only a triangle is classified', () => {
    assert.equal(cls([[0, 0], [1, 0], [1, 1], [0, 1]]), null);
  });
});

describe('measure: a segment and a circle', () => {
  it('a segment has its length', () => {
    const { scene, ids } = withPoints([[0, 0], [3, 4]]);
    const m = measure(addSegment(scene, ids[0], ids[1]).scene)[0] as SegmentMeasure;
    assert.equal(m.kind, 'segment');
    assert.equal(m.name, 'AB');
    close(m.length, 5);
  });
  it('a circle has radius, circumference, area and the book\'s equation numbers (a, b, r²)', () => {
    const { scene, ids } = withPoints([[2, -1], [5, 3]]);
    const m = measure(addCircle(scene, ids[0], ids[1]).scene)[0] as CircleMeasure;
    assert.equal(m.kind, 'circle');
    close(m.radius, 5);
    close(m.circumference, 10 * Math.PI);
    close(m.area, 25 * Math.PI);
    assert.deepEqual([m.a, m.b], [2, -1]);
    close(m.r2, 25);
  });
  it('measures every shape, in the order they were drawn', () => {
    const { scene, ids } = withPoints([[0, 0], [4, 0], [4, 3]]);
    const s1 = addSegment(scene, ids[0], ids[1]);
    const s2 = addPolygon(s1.scene, ids);
    const s3 = addCircle(s2.scene, ids[0], ids[2]);
    assert.deepEqual(measure(s3.scene).map(m => m.kind), ['segment', 'polygon', 'circle']);
  });
  it('an empty scene measures to nothing', () => {
    assert.deepEqual(measure(emptyScene()), []);
  });
});

describe('circleEquationText: (x − a)² + (y − b)² = r²', () => {
  it('writes the signs the way the book does', () => {
    assert.equal(circleEquationText(2, -1, 25), '(x − 2)² + (y + 1)² = 25');
    assert.equal(circleEquationText(-3, 4, 9), '(x + 3)² + (y − 4)² = 9');
  });
  it('a centre on an axis collapses that term', () => {
    assert.equal(circleEquationText(0, 0, 25), 'x² + y² = 25');
    assert.equal(circleEquationText(0, 2, 4), 'x² + (y − 2)² = 4');
    assert.equal(circleEquationText(-1, 0, 4), '(x + 1)² + y² = 4');
  });
  it('trims decimals and float noise', () => {
    assert.equal(circleEquationText(0.5, 0.25, 2.0000000001), '(x − 0.5)² + (y − 0.25)² = 2');
  });
});

describe('sketchTap: what a tap does in each tool', () => {
  const vp = makeViewport(360, 360, 'standard');
  const at = (x: number, y: number) => toPx(vp, x, y);
  const tap = (tool: Parameters<typeof sketchTap>[0], scene: Scene, pending: string[], x: number, y: number, snap = false) => {
    const p = at(x, y);
    return sketchTap(tool, pending, scene, vp, p.x, p.y, { snap });
  };

  it('the point tool places a point, snapped on request, and ignores a tap on an existing one', () => {
    const r = tap('point', emptyScene(), [], 2.4, 3.6, true);
    assert.deepEqual([r.scene.points[0].x, r.scene.points[0].y], [2, 4]);
    const again = tap('point', r.scene, [], 2.05, 3.95, true);
    assert.equal(again.scene.points.length, 1);
  });
  it('the segment tool takes two taps and makes the points it needs', () => {
    let r = tap('segment', emptyScene(), [], 0, 0, true);
    assert.equal(r.pending.length, 1);
    assert.equal(r.scene.shapes.length, 0);
    r = tap('segment', r.scene, r.pending, 4, 3, true);
    assert.equal(r.pending.length, 0);
    assert.equal(r.scene.points.length, 2);
    assert.equal(r.scene.shapes[0].kind, 'segment');
  });
  it('tapping an existing point reuses it, so shapes share corners', () => {
    const { scene } = withPoints([[0, 0], [4, 0]]);
    let r = tap('segment', scene, [], 0, 0);
    r = tap('segment', r.scene, r.pending, 4, 0);
    assert.equal(r.scene.points.length, 2);
    assert.equal(r.scene.shapes.length, 1);
  });
  it('tapping the same point twice does not make a zero-length segment', () => {
    let r = tap('segment', emptyScene(), [], 1, 1, true);
    r = tap('segment', r.scene, r.pending, 1, 1, true);
    assert.equal(r.scene.shapes.length, 0);
    assert.equal(r.pending.length, 1);
  });
  it('the circle tool takes a centre then a point on the circle', () => {
    let r = tap('circle', emptyScene(), [], 0, 0, true);
    r = tap('circle', r.scene, r.pending, 3, 4, true);
    assert.equal(r.scene.shapes[0].kind, 'circle');
    assert.equal(r.pending.length, 0);
  });
  it('the polygon tool collects vertices and closes when the first one is tapped again', () => {
    let r = tap('polygon', emptyScene(), [], 0, 0, true);
    for (const [x, y] of [[4, 0], [4, 3]]) r = tap('polygon', r.scene, r.pending, x, y, true);
    assert.equal(r.scene.shapes.length, 0);
    assert.equal(r.pending.length, 3);
    r = tap('polygon', r.scene, r.pending, 0, 0, true);
    assert.equal(r.scene.shapes[0].kind, 'polygon');
    assert.equal(r.pending.length, 0);
  });
  it('tapping the first vertex early does not close a polygon of two points', () => {
    let r = tap('polygon', emptyScene(), [], 0, 0, true);
    r = tap('polygon', r.scene, r.pending, 4, 0, true);
    r = tap('polygon', r.scene, r.pending, 0, 0, true);
    assert.equal(r.scene.shapes.length, 0);
    assert.equal(r.pending.length, 2);
  });
  it('closePolygon is the button for the same thing', () => {
    let r = tap('polygon', emptyScene(), [], 0, 0, true);
    for (const [x, y] of [[4, 0], [4, 3]]) r = tap('polygon', r.scene, r.pending, x, y, true);
    const done = closePolygon(r.scene, r.pending);
    assert.equal(done.scene.shapes[0].kind, 'polygon');
    assert.equal(closePolygon(r.scene, r.pending.slice(0, 2)).scene.shapes.length, 0);
  });
  it('the delete tool removes a tapped point (and its shapes), else a tapped shape', () => {
    const { scene, ids } = withPoints([[0, 0], [4, 0], [4, 3]]);
    const withShapes = addPolygon(scene, ids).scene;
    const noPoint = tap('delete', withShapes, [], 4, 1.5);
    assert.equal(noPoint.scene.shapes.length, 0);
    assert.equal(noPoint.scene.points.length, 3);
    const noShape = tap('delete', withShapes, [], 4, 0);
    assert.equal(noShape.scene.points.length, 2);
    assert.equal(noShape.scene.shapes.length, 0);
  });
  it('the move tool never changes the scene on a tap', () => {
    const { scene } = withPoints([[0, 0]]);
    assert.equal(tap('move', scene, [], 5, 5).scene, scene);
  });
  it('a full scene says so instead of silently dropping the tap', () => {
    let scene = emptyScene();
    for (let i = 0; i < MAX_POINTS; i++) scene = addPoint(scene, i - 13, i % 2 ? 5 : -5).scene;
    const r = tap('point', scene, [], 0, 0);
    assert.equal(r.scene.points.length, MAX_POINTS);
    assert.equal(r.notice, 'full');
  });
});
