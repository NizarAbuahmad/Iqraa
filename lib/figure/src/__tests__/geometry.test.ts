import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { layoutFigure, placeLabel, type Pt } from '../geometry.ts';
import { resolveFigure } from '../gate.ts';
import type { Figure } from '../types.ts';
import { bounds, gridTicks, toPx, toWorld } from '../viewport.ts';

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

  it('emits no point or label for a marked point outside the given y range', () => {
    // The gate now refuses such a figure, so it is built by hand: the geometry's
    // own defensive drop is what is tested here.
    const base = { kind: 'function-graph', functions: [{ expr: 'x^2' }], x: [-3, 3], y: [-1, 3] };
    const off = layoutFigure({ ...base, points: [{ at: 3, label: 'A', on: 0 }] } as Figure, BOX);
    assert.equal(off.points.length, 0);
    const mixed = layoutFigure({ ...base, points: [{ at: 3, label: 'A', on: 0 }, { at: 1, label: 'B', on: 0 }] } as Figure, BOX);
    assert.equal(mixed.points.length, 1);
    assert.equal(mixed.points[0]!.label, 'B');
  });

  it('keeps every gated marked point inside an auto-fitted box', () => {
    // 2^x on [0,10]: the 98th-percentile fit alone leaves x=10 (y=1024) off the top.
    const l = layoutFigure(fig({ kind: 'function-graph', functions: [{ expr: '2^x' }], x: [0, 10], points: [{ at: 10, label: 'A' }] }), BOX);
    assert.equal(l.points.length, 1);
    const p = l.points[0]!.at;
    assert.ok(p.x >= 0 && p.x <= BOX.w && p.y >= 0 && p.y <= BOX.h, JSON.stringify(p));
  });

  it('lays out a nearly flat curve far from zero with a finite scale and a grid', () => {
    const l = layoutFigure(fig({ kind: 'function-graph', functions: [{ expr: '100000000 + x/10000' }], x: [-1, 1] }), BOX);
    assert.ok(Number.isFinite(l.viewport.sy) && l.viewport.sy > 0, String(l.viewport.sy));
    const t = gridTicks(l.viewport);
    assert.ok(t.xs.length <= 2000 && t.ys.length <= 2000);
    assert.ok(t.ys.length > 0, 'a readable grid, not none');
    const b = bounds(l.viewport);
    assert.ok(b.yMax - b.yMin >= 99.9, `fitted span ${b.yMax - b.yMin} is below the minimum for values near 1e8`);
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

  // These are split by the sign-flip + jump rule alone; the clip cut-off does not
  // reach them, so removing the rule joins neighbouring branches.
  it('splits tan(2x) into five branches', () => {
    const l = layoutFigure(fig({ kind: 'function-graph', functions: [{ expr: 'tan(2x)' }], x: [-3, 3] }), BOX);
    assert.equal(l.curves[0]!.segments.length, 5);
    monotone(l, 1);
  });

  it('splits 1/(x^2-1) into three branches', () => {
    const l = layoutFigure(fig({ kind: 'function-graph', functions: [{ expr: '1/(x^2-1)' }], x: [-3, 3] }), BOX);
    assert.equal(l.curves[0]!.segments.length, 3);
  });

  it('splits tan(x) over [-6.3, 6.3] into five branches', () => {
    const l = layoutFigure(fig({ kind: 'function-graph', functions: [{ expr: 'tan(x)' }], x: [-6.3, 6.3] }), BOX);
    assert.equal(l.curves[0]!.segments.length, 5);
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

// A letter is the only non-colour cue, so it must be readable: clear of its own line, inside the box.
// The text is start-anchored with its baseline at y; the box below is the glyph's, as `placeLabel` assumes.
const PHONE = { w: 312, h: 238 };
const centreOf = (p: Pt): Pt => ({ x: p.x + 5, y: p.y - 4.5 });
const inside = (p: Pt, box: { w: number; h: number }) =>
  p.x >= 2 && p.x + 10 <= box.w - 2 && p.y - 11 >= 2 && p.y + 2 <= box.h - 2;
const distToSegment = (p: Pt, a: Pt, b: Pt): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};
const distToPolylines = (p: Pt, lines: Pt[][]): number => {
  let d = Infinity;
  for (const l of lines) for (let i = 0; i < l.length; i++) d = Math.min(d, distToSegment(p, l[i]!, l[Math.min(i + 1, l.length - 1)]!));
  return d;
};

describe('layoutFigure: a letter is clear of its own line', () => {
  it('(a) the point letter «A» on x^2 - 4 is ≥ 9px from the curve and inside the box', () => {
    const l = layoutFigure(fig({ kind: 'function-graph', functions: [{ expr: 'x^2 - 4', label: 'f' }], x: [-3, 3], points: [{ at: 1, label: 'A' }] }), PHONE);
    const a = l.points[0]!.labelAt;
    assert.ok(inside(a, PHONE), `A at ${JSON.stringify(a)}`);
    const d = distToPolylines(centreOf(a), l.curves[0]!.segments);
    assert.ok(d >= 9, `A is ${d.toFixed(1)}px from the curve`);
  });

  it('(b) the letters of two curves are each ≥ 9px from their own curve, inside the box, and ≥ 10px apart', () => {
    const l = layoutFigure(fig({ kind: 'function-graph', functions: [{ expr: 'x', label: 'f' }, { expr: 'x^2', label: 'g' }], x: [-2, 2] }), PHONE);
    for (const c of l.curves) {
      assert.ok(c.labelAt && inside(c.labelAt, PHONE), `${c.label} at ${JSON.stringify(c.labelAt)}`);
      const d = distToPolylines(centreOf(c.labelAt!), c.segments);
      assert.ok(d >= 9, `${c.label} is ${d.toFixed(1)}px from its curve`);
    }
    const [f, g] = l.curves.map(c => centreOf(c.labelAt!)) as [Pt, Pt];
    assert.ok(Math.hypot(f.x - g.x, f.y - g.y) >= 10, 'the two letters overlap');
  });

  it('(b2) the same holds on a wide desktop box and for a marked point on the second curve', () => {
    const wide = { w: 518, h: 238 };
    const l = layoutFigure(fig({ kind: 'function-graph', functions: [{ expr: 'x', label: 'f' }, { expr: 'x^2', label: 'g' }], x: [-2, 2], points: [{ at: 1, label: 'A', on: 1 }] }), wide);
    for (const c of l.curves) {
      assert.ok(inside(c.labelAt!, wide));
      assert.ok(distToPolylines(centreOf(c.labelAt!), c.segments) >= 9, `${c.label}`);
    }
    const a = l.points[0]!.labelAt;
    assert.ok(inside(a, wide));
    assert.ok(distToPolylines(centreOf(a), l.curves[1]!.segments) >= 9, 'A is on its curve');
  });

  it('(c) each vector letter is ≥ 9px from its own shaft and inside the box', () => {
    const l = layoutFigure(fig({ kind: 'vectors', vectors: [{ from: [0, 0], to: [3, 2], label: 'u' }, { from: [0, 0], to: [-1, 2.5], label: 'v' }], components: true }), PHONE);
    for (const a of l.arrows) {
      assert.ok(a.labelAt && inside(a.labelAt, PHONE), `${a.label} at ${JSON.stringify(a.labelAt)}`);
      const d = distToPolylines(centreOf(a.labelAt!), [[a.from, a.to]]);
      assert.ok(d >= 9, `${a.label} is ${d.toFixed(1)}px from its shaft`);
    }
    const [u, v] = l.arrows.map(a => centreOf(a.labelAt!)) as [Pt, Pt];
    assert.ok(Math.hypot(u.x - v.x, u.y - v.y) >= 10, 'the two letters overlap');
  });

  it('(c2) horizontal, vertical and diagonal shafts together: every letter clear of every shaft', () => {
    const l = layoutFigure(fig({ kind: 'vectors', vectors: [{ from: [0, 0], to: [3, 0], label: 'u' }, { from: [0, 0], to: [0, 3], label: 'v' }, { from: [0, 0], to: [2, 2], label: 'w' }, { from: [0, 0], to: [-2, -1], label: 'z' }] }), PHONE);
    const shafts = l.arrows.map(a => [a.from, a.to]);
    for (const a of l.arrows) {
      assert.ok(a.labelAt && inside(a.labelAt, PHONE), `${a.label} at ${JSON.stringify(a.labelAt)}`);
      const d = distToPolylines(centreOf(a.labelAt!), shafts);
      assert.ok(d >= 9, `${a.label} is ${d.toFixed(1)}px from a shaft`);
    }
  });

  it('(d) a curve that fills the whole box still gets an inside-the-box letter, finite, without throwing', () => {
    // A hand-made raster of lines every 4px: nothing is ≥ 9px from a line, so the best-of fallback must answer.
    const fill: Pt[][] = [];
    for (let y = 0; y <= PHONE.h; y += 4) fill.push([{ x: 0, y }, { x: PHONE.w, y }]);
    const p = placeLabel([{ x: 300, y: 5 }, { x: 100, y: 100 }, { x: Number.NaN, y: 3 }, { x: 900, y: 900 }], fill, PHONE);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), JSON.stringify(p));
    assert.ok(inside(p, PHONE), JSON.stringify(p));
    // no candidate at all, or none inside: still an inside position
    const q = placeLabel([{ x: -50, y: -50 }], fill, PHONE);
    assert.ok(inside(q, PHONE), JSON.stringify(q));
    const r = placeLabel([], [], PHONE);
    assert.ok(inside(r, PHONE), JSON.stringify(r));
    // and a real figure whose curve zigzags across the whole box
    const l = layoutFigure(fig({ kind: 'function-graph', functions: [{ expr: 'sin(60x)', label: 'f' }], x: [-3, 3], points: [{ at: 0.1, label: 'A' }] }), PHONE);
    for (const q2 of [l.curves[0]!.labelAt!, l.points[0]!.labelAt]) {
      assert.ok(Number.isFinite(q2.x) && Number.isFinite(q2.y) && inside(q2, PHONE), JSON.stringify(q2));
    }
  });
});
