import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_SCALE,
  MIN_SCALE,
  bounds,
  equalize,
  gridTicks,
  makeViewport,
  niceStep,
  panBy,
  pinchDelta,
  resize,
  toPx,
  toWorld,
  zoomAt,
} from '../mathViewport.ts';

function close(actual: number, expected: number, tol = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} != ${expected}`);
}

describe('makeViewport and the coordinate maps', () => {
  it('the standard viewport is equal-aspect, centred on the origin, ±10 on the short side', () => {
    const vp = makeViewport(360, 400, 'standard');
    assert.equal(vp.sx, vp.sy);
    assert.equal(vp.cx, 0);
    assert.equal(vp.cy, 0);
    const b = bounds(vp);
    close(b.xMax, 10);
    close(b.xMin, -10);
    assert.ok(b.yMax > 10);
  });
  it('maps the centre to the middle of the canvas, with y pointing up', () => {
    const vp = makeViewport(300, 200, 'standard');
    const mid = toPx(vp, vp.cx, vp.cy);
    close(mid.x, 150);
    close(mid.y, 100);
    assert.ok(toPx(vp, 0, 5).y < toPx(vp, 0, 0).y);
    assert.ok(toPx(vp, 5, 0).x > toPx(vp, 0, 0).x);
  });
  it('toWorld inverts toPx', () => {
    const vp = panBy(makeViewport(320, 480, 'standard'), 37, -12);
    for (const [x, y] of [[0, 0], [3.25, -7.5], [-100, 42]]) {
      const p = toPx(vp, x, y);
      const w = toWorld(vp, p.x, p.y);
      close(w.x, x);
      close(w.y, y);
    }
  });
  it('a circle of radius 5 is the same size across and up: equal aspect, no ellipse', () => {
    const vp = makeViewport(360, 640, 'standard');
    const o = toPx(vp, 0, 0);
    const right = toPx(vp, 5, 0);
    const up = toPx(vp, 0, 5);
    close(right.x - o.x, o.y - up.y);
  });
  it('the trig presets are free-aspect and show a whole period', () => {
    const deg = bounds(makeViewport(360, 300, 'trig-deg'));
    assert.ok(deg.xMin < 0 && deg.xMax > 360);
    assert.ok(deg.yMax > 1 && deg.yMin < -1);
    const rad = bounds(makeViewport(360, 300, 'trig-rad'));
    assert.ok(rad.xMin < 0 && rad.xMax > 2 * Math.PI);
    const vp = makeViewport(360, 300, 'trig-deg');
    assert.notEqual(vp.sx, vp.sy);
  });
});

describe('panBy', () => {
  it('drags the world with the finger: the point under it stays under it', () => {
    const vp = makeViewport(360, 360, 'standard');
    const before = toWorld(vp, 100, 100);
    const moved = panBy(vp, 36, -18);
    const after = toWorld(moved, 100 + 36, 100 - 18);
    close(after.x, before.x);
    close(after.y, before.y);
  });
  it('dragging right by 36 px at 18 px per unit moves the centre left by 2', () => {
    const vp = makeViewport(360, 360, 'standard');
    close(panBy(vp, 36, 0).cx, -2);
  });
});

describe('zoomAt', () => {
  it('keeps the anchor pixel fixed on the same world point', () => {
    const vp = panBy(makeViewport(360, 500, 'standard'), 20, 30);
    const before = toWorld(vp, 250, 120);
    for (const f of [0.3, 0.9, 1.7, 4]) {
      const z = zoomAt(vp, f, 250, 120);
      const after = toWorld(z, 250, 120);
      close(after.x, before.x);
      close(after.y, before.y);
    }
  });
  it('scales both axes together, so equal-aspect stays equal-aspect', () => {
    const vp = makeViewport(360, 360, 'standard');
    const z = zoomAt(vp, 2, 180, 180);
    close(z.sx, vp.sx * 2);
    assert.equal(z.sx, z.sy);
  });
  it('can scale one axis only', () => {
    const vp = makeViewport(360, 360, 'standard');
    const zx = zoomAt(vp, 2, 180, 180, 'x');
    close(zx.sx, vp.sx * 2);
    assert.equal(zx.sy, vp.sy);
    const zy = zoomAt(vp, 2, 180, 180, 'y');
    assert.equal(zy.sx, vp.sx);
    close(zy.sy, vp.sy * 2);
  });
  it('is clamped, and equal-aspect survives the clamp', () => {
    const vp = makeViewport(360, 360, 'standard');
    const huge = zoomAt(vp, 1e12, 180, 180);
    assert.equal(huge.sx, MAX_SCALE);
    assert.equal(huge.sy, MAX_SCALE);
    const tiny = zoomAt(vp, 1e-12, 180, 180);
    assert.equal(tiny.sx, MIN_SCALE);
    assert.equal(tiny.sy, MIN_SCALE);
  });
  it('a zero, negative or non-finite factor changes nothing', () => {
    const vp = makeViewport(360, 360, 'standard');
    for (const f of [0, -2, Number.NaN, Infinity]) assert.deepEqual(zoomAt(vp, f, 10, 10), vp);
  });
});

describe('resize and equalize', () => {
  it('resize keeps the centre and the scales, showing more or less world', () => {
    const vp = makeViewport(360, 400, 'standard');
    const r = resize(vp, 720, 400);
    assert.equal(r.cx, vp.cx);
    assert.equal(r.sx, vp.sx);
    assert.equal(r.w, 720);
    assert.ok(bounds(r).xMax > bounds(vp).xMax);
  });
  it('equalize makes a free-aspect view equal-aspect without moving the centre', () => {
    const vp = makeViewport(360, 300, 'trig-deg');
    const e = equalize(vp);
    assert.equal(e.sx, e.sy);
    assert.equal(e.cx, vp.cx);
    assert.equal(e.cy, vp.cy);
  });
});

describe('pinchDelta', () => {
  it('fingers twice as far apart is a zoom of 2 about the midpoint', () => {
    const d = pinchDelta([{ x: 100, y: 100 }, { x: 200, y: 100 }], [{ x: 50, y: 100 }, { x: 250, y: 100 }]);
    assert.ok(d);
    close(d.factor, 2);
    close(d.anchorX, 150);
    close(d.anchorY, 100);
    close(d.panX, 0);
  });
  it('both fingers sliding together is a pan with no zoom', () => {
    const d = pinchDelta([{ x: 100, y: 100 }, { x: 200, y: 100 }], [{ x: 130, y: 90 }, { x: 230, y: 90 }]);
    assert.ok(d);
    close(d.factor, 1);
    close(d.panX, 30);
    close(d.panY, -10);
  });
  it('is null when it cannot be told (not two fingers, or no distance to compare)', () => {
    assert.equal(pinchDelta([{ x: 1, y: 1 }], [{ x: 1, y: 1 }, { x: 2, y: 2 }]), null);
    assert.equal(pinchDelta([{ x: 5, y: 5 }, { x: 5, y: 5 }], [{ x: 1, y: 1 }, { x: 9, y: 9 }]), null);
    assert.equal(pinchDelta([], []), null);
  });
});

describe('niceStep', () => {
  it('picks 1, 2 or 5 times a power of ten, far enough apart to read', () => {
    assert.equal(niceStep(10, 56), 10);
    assert.equal(niceStep(18, 56), 5);
    assert.equal(niceStep(100, 56), 1);
    assert.equal(niceStep(1000, 56), 0.1);
    assert.equal(niceStep(0.01, 56), 10000);
  });
  it('is never closer than the minimum, and gets finer as the view zooms in', () => {
    let last = Infinity;
    for (const px of [0.05, 0.3, 1, 4, 18, 70, 300, 2500, 5000]) {
      const step = niceStep(px, 56);
      assert.ok(step * px >= 56, `${px}: ${step}`);
      assert.ok(step <= last);
      last = step;
    }
  });
  it('degree mode steps in 15, 30, 45, 90, 180, 360', () => {
    assert.equal(niceStep(1, 56, 'deg'), 90);
    assert.equal(niceStep(2, 56, 'deg'), 30);
    assert.equal(niceStep(0.2, 56, 'deg'), 360);
    assert.equal(niceStep(4, 56, 'deg'), 15);
  });
});

describe('gridTicks', () => {
  it('lists multiples of the step inside the view, including zero', () => {
    const vp = makeViewport(360, 360, 'standard');
    const { xs, ys } = gridTicks(vp);
    assert.ok(xs.some(t => t.value === 0));
    assert.ok(ys.some(t => t.value === 0));
    const b = bounds(vp);
    for (const t of xs) assert.ok(t.value >= b.xMin - 1e-9 && t.value <= b.xMax + 1e-9);
    for (const t of ys) assert.ok(t.value >= b.yMin - 1e-9 && t.value <= b.yMax + 1e-9);
  });
  it('values are clean decimals, not 0.30000000000000004', () => {
    const vp = zoomAt(makeViewport(360, 360, 'standard'), 40, 180, 180);
    const { xs } = gridTicks(vp);
    for (const t of xs) assert.equal(t.value, Number(t.value.toFixed(6)), String(t.value));
    assert.ok(xs.some(t => t.value === 0.1) || xs.some(t => t.value === 0.2));
  });
  it('each tick carries the pixel it sits at', () => {
    const vp = makeViewport(360, 360, 'standard');
    for (const t of gridTicks(vp).xs) close(t.px, toPx(vp, t.value, 0).x);
    for (const t of gridTicks(vp).ys) close(t.px, toPx(vp, 0, t.value).y);
  });
  it('never emits an unreadable crowd of ticks', () => {
    for (const f of [0.01, 1, 50, 5000]) {
      const vp = zoomAt(makeViewport(360, 640, 'standard'), f, 180, 320);
      const { xs, ys } = gridTicks(vp);
      assert.ok(xs.length <= 40 && ys.length <= 40, `${f}: ${xs.length}/${ys.length}`);
    }
  });
  it('degree mode ticks fall on multiples of the degree step', () => {
    const vp = makeViewport(360, 300, 'trig-deg');
    const { xs } = gridTicks(vp, 'deg');
    assert.ok(xs.some(t => t.value === 180));
    assert.ok(xs.every(t => t.value % 15 === 0));
  });
});
