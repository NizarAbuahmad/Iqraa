import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { layoutFigure } from '../geometry.ts';
import { resolveFigure } from '../gate.ts';
import { bounds, toPx, toWorld } from '../viewport.ts';

const BOX = { w: 400, h: 300 };
const fig = (raw: unknown) => resolveFigure(raw)!;
const near = (a: number, b: number, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);

describe('layoutFigure: function-graph', () => {
  const parabola = fig({ kind: 'function-graph', functions: [{ expr: 'x^2 - 4', label: 'f' }], x: [-3, 3], points: [{ at: 2, label: 'A' }] });
  const lay = layoutFigure(parabola, BOX);

  it('draws one unbroken curve of 240 samples', () => {
    assert.equal(lay.curves.length, 1);
    assert.equal(lay.curves[0]!.segments.length, 1);
    assert.equal(lay.curves[0]!.segments[0]!.length, 240);
  });

  it('fits the viewport around the curve and keeps the x axis in view', () => {
    const b = bounds(lay.viewport);
    assert.ok(b.xMin <= -3 && b.xMax >= 3);
    assert.ok(b.yMin <= -4 && b.yMax >= 5, `${b.yMin}..${b.yMax}`);
    assert.ok(b.yMin <= 0 && b.yMax >= 0);
  });

  it('puts a marked point on the curve at its computed y', () => {
    const a = lay.points[0]!;
    const want = toPx(lay.viewport, 2, 0);
    near(a.at.x, want.x);
    near(a.at.y, want.y);
    assert.equal(a.label, 'A');
  });

  it('keeps labels inside the box', () => {
    for (const p of [lay.curves[0]!.labelAt!, lay.points[0]!.labelAt]) {
      assert.ok(p.x >= 0 && p.x <= BOX.w && p.y >= 0 && p.y <= BOX.h, JSON.stringify(p));
    }
  });

  it('honours a given y range', () => {
    const l = layoutFigure(fig({ kind: 'function-graph', functions: [{ expr: 'x' }], x: [-2, 2], y: [-10, 10] }), BOX);
    const b = bounds(l.viewport);
    near(b.yMin, -10);
    near(b.yMax, 10);
  });
});

describe('layoutFigure: asymptotes never join two branches', () => {
  // A branch that wrongly joined across an asymptote would, in world units, step
  // the wrong way (tan only rises on a branch, 1/x only falls). Steep climbs that
  // run off the canvas are legitimate and are not what this checks.
  const monotone = (l: ReturnType<typeof layoutFigure>, dir: 1 | -1) => {
    for (const c of l.curves) for (const s of c.segments) {
      const ys = s.map(p => toWorld(l.viewport, p.x, p.y).y);
      for (let i = 1; i < ys.length; i++) {
        assert.ok(dir * (ys[i]! - ys[i - 1]!) >= -1e-9, `a branch steps the wrong way at point ${i}`);
      }
    }
  };

  it('splits 1/x into two branches', () => {
    const l = layoutFigure(fig({ kind: 'function-graph', functions: [{ expr: '1/x' }], x: [-2, 2] }), BOX);
    assert.equal(l.curves[0]!.segments.length, 2);
    monotone(l, -1);
  });

  it('splits tan(x) at its asymptotes', () => {
    const l = layoutFigure(fig({ kind: 'function-graph', functions: [{ expr: 'tan(x)' }], x: [-3, 3] }), BOX);
    assert.ok(l.curves[0]!.segments.length >= 3);
    monotone(l, 1);
  });

  it('does not cut a steep monotone curve short', () => {
    const l = layoutFigure(fig({ kind: 'function-graph', functions: [{ expr: '2^x' }], x: [0, 10] }), BOX);
    const segs = l.curves[0]!.segments;
    assert.equal(segs.length, 1);
    assert.equal(segs[0]!.length, 240);
  });
});

describe('layoutFigure: vectors', () => {
  const v = fig({ kind: 'vectors', vectors: [{ from: [0, 0], to: [3, 2], label: 'u' }, { from: [0, 0], to: [-1, 2.5], label: 'v' }], components: true });
  const lay = layoutFigure(v, BOX);

  it('uses the same scale on both axes', () => {
    near(lay.viewport.sx, lay.viewport.sy);
  });

  it('shows the origin and every endpoint', () => {
    const b = bounds(lay.viewport);
    for (const [x, y] of [[0, 0], [3, 2], [-1, 2.5]] as const) {
      assert.ok(x >= b.xMin && x <= b.xMax && y >= b.yMin && y <= b.yMax, `${x},${y}`);
    }
  });

  it('puts the arrow tip on the end point and the head behind it', () => {
    const a = lay.arrows[0]!;
    const tip = toPx(lay.viewport, 3, 2);
    near(a.to.x, tip.x);
    near(a.to.y, tip.y);
    assert.deepEqual(a.head[0], a.to);
    // the two base corners are equally far from the shaft
    const d = (p: { x: number; y: number }) => Math.hypot(p.x - a.to.x, p.y - a.to.y);
    near(d(a.head[1]), d(a.head[2]), 1e-6);
  });

  it('draws two dashed component lines per vector', () => {
    assert.equal(lay.components.length, 4);
  });

  it('leaves a figure without components with none', () => {
    const plain = layoutFigure(fig({ kind: 'vectors', vectors: [{ from: [0, 0], to: [1, 1] }] }), BOX);
    assert.equal(plain.components.length, 0);
    assert.equal(plain.arrows[0]!.label, undefined);
  });

  it('keeps a small figure from filling the canvas with one tiny arrow', () => {
    const l = layoutFigure(fig({ kind: 'vectors', vectors: [{ from: [0, 0], to: [0.5, 0.5] }] }), BOX);
    const b = bounds(l.viewport);
    assert.ok(b.xMax - b.xMin >= 4 && b.yMax - b.yMin >= 4);
  });
});
