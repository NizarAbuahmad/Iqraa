import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../mathExpr.ts';
import { makeViewport, panBy, toPx, type Point } from '../mathViewport.ts';
import {
  curveSegments,
  findExtrema,
  findIntersections,
  findRoots,
  parseCurveInput,
  toPathD,
  traceAt,
  verticalLine,
} from '../mathGraph.ts';

function fn(src: string, angle?: 'deg' | 'rad') {
  const r = compile(src, { angle });
  assert.ok(r.ok, `"${src}" did not compile`);
  return r.f;
}
function close(actual: number, expected: number, tol = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} != ${expected}`);
}
const xsOf = (seg: Point[]) => seg.map(p => p.x);

describe('parseCurveInput', () => {
  it('an explicit function, with or without a name', () => {
    assert.deepEqual(parseCurveInput('y=2x+1'), { ok: true, kind: 'explicit', expr: '2x+1' });
    assert.deepEqual(parseCurveInput('f(x)=x^2'), { ok: true, kind: 'explicit', expr: 'x^2' });
    assert.deepEqual(parseCurveInput('G(x) = x - 3'), { ok: true, kind: 'explicit', expr: 'x - 3' });
    assert.deepEqual(parseCurveInput('x^2'), { ok: true, kind: 'explicit', expr: 'x^2' });
    assert.deepEqual(parseCurveInput('  y = x ^ 2  '), { ok: true, kind: 'explicit', expr: 'x ^ 2' });
  });
  it('Arabic names: ص for y and س for x', () => {
    assert.deepEqual(parseCurveInput('ص=س^2'), { ok: true, kind: 'explicit', expr: 'x^2' });
  });
  it('a vertical line, with its number read the way the calculator reads it', () => {
    assert.deepEqual(parseCurveInput('x=3'), { ok: true, kind: 'vertical', x: 3 });
    assert.deepEqual(parseCurveInput('س=-2'), { ok: true, kind: 'vertical', x: -2 });
    assert.deepEqual(parseCurveInput('x=٣٫٥'), { ok: true, kind: 'vertical', x: 3.5 });
    assert.deepEqual(parseCurveInput('x=sqrt(16)'), { ok: true, kind: 'vertical', x: 4 });
  });
  it('a vertical line whose value is not a number is refused', () => {
    assert.deepEqual(parseCurveInput('x=abc'), { ok: false, reason: 'bad-vertical' });
    assert.deepEqual(parseCurveInput('x=1/0'), { ok: false, reason: 'bad-vertical' });
  });
  it('an implicit equation is refused, not graphed wrongly', () => {
    assert.deepEqual(parseCurveInput('x^2+y^2=25'), { ok: false, reason: 'implicit-unsupported' });
    assert.deepEqual(parseCurveInput('2x=y'), { ok: false, reason: 'implicit-unsupported' });
    assert.deepEqual(parseCurveInput('y=x=2'), { ok: false, reason: 'implicit-unsupported' });
  });
  it('nothing to graph', () => {
    assert.deepEqual(parseCurveInput(''), { ok: false, reason: 'empty' });
    assert.deepEqual(parseCurveInput('   '), { ok: false, reason: 'empty' });
    assert.deepEqual(parseCurveInput('y='), { ok: false, reason: 'empty' });
  });
});

describe('curveSegments', () => {
  const vp = makeViewport(360, 360, 'standard');

  it('a smooth curve is one segment, sampled across the whole width', () => {
    const segs = curveSegments(fn('x^2'), vp);
    assert.equal(segs.length, 1);
    assert.ok(segs[0].length >= 150, `only ${segs[0].length} points`);
    assert.ok(segs[0][0].x <= 1 && segs[0][segs[0].length - 1].x >= 359);
  });
  it('draws only where the function is defined', () => {
    const segs = curveSegments(fn('sqrt(x)'), vp);
    assert.equal(segs.length, 1);
    const zero = toPx(vp, 0, 0).x;
    for (const x of xsOf(segs[0])) assert.ok(x >= zero - 3, `${x} is left of the origin ${zero}`);
  });
  it('breaks at a pole: 1/x is two pieces and neither crosses x = 0', () => {
    const segs = curveSegments(fn('1/x'), vp);
    assert.equal(segs.length, 2);
    const zero = toPx(vp, 0, 0).x;
    assert.ok(Math.max(...xsOf(segs[0])) < zero + 1e-6);
    assert.ok(Math.min(...xsOf(segs[1])) > zero - 1e-6);
  });
  it('tan in degrees breaks at 90° and 270° and never draws across them', () => {
    const view = makeViewport(360, 300, 'trig-deg');
    const segs = curveSegments(fn('tan(x)'), view);
    assert.ok(segs.length >= 3, `${segs.length} segments`);
    for (const pole of [90, 270]) {
      const px = toPx(view, pole, 0).x;
      for (const seg of segs) {
        const xs = xsOf(seg);
        assert.ok(!(Math.min(...xs) < px - 1 && Math.max(...xs) > px + 1), `a segment spans ${pole}°`);
      }
    }
  });
  it('breaks at a pole that falls BETWEEN two samples, where the value is never undefined', () => {
    // 0.05 is not a multiple of the 0.111 sample step, so no sample lands on the pole.
    const segs = curveSegments(fn('1/(x-0.05)'), vp);
    assert.equal(segs.length, 2);
    const pole = toPx(vp, 0.05, 0).x;
    for (const seg of segs) {
      const xs = xsOf(seg);
      assert.ok(!(Math.min(...xs) < pole - 1 && Math.max(...xs) > pole + 1), 'a segment spans the pole');
    }
  });
  it('tan breaks at its poles even when no sample lands on them', () => {
    const shifted = panBy(makeViewport(360, 300, 'trig-deg'), 1, 0); // 1 px = 1.25°
    const segs = curveSegments(fn('tan(x)'), shifted);
    assert.ok(segs.length >= 3, `${segs.length} segments`);
    for (const pole of [90, 270]) {
      const px = toPx(shifted, pole, 0).x;
      for (const seg of segs) {
        const xs = xsOf(seg);
        assert.ok(!(Math.min(...xs) < px - 1 && Math.max(...xs) > px + 1), `a segment spans ${pole}°`);
      }
    }
  });
  it('a steep but continuous curve stays one piece', () => {
    assert.equal(curveSegments(fn('x^7'), vp).length, 1);
    assert.equal(curveSegments(fn('2^x'), vp).length, 1);
  });
  it('sin is one piece in either unit when the view matches', () => {
    assert.equal(curveSegments(fn('sin(x)'), makeViewport(360, 300, 'trig-deg')).length, 1);
    assert.equal(curveSegments(fn('sin(x)', 'rad'), makeViewport(360, 300, 'trig-rad')).length, 1);
  });
  it('clamps pixels so a huge value cannot break the drawing', () => {
    for (const seg of curveSegments(fn('x^9'), vp)) {
      for (const p of seg) assert.ok(Number.isFinite(p.y) && Math.abs(p.y) <= 1e5, String(p.y));
    }
  });
  it('a function undefined everywhere draws nothing', () => {
    assert.deepEqual(curveSegments(fn('sqrt(-x^2-1)'), vp), []);
  });
});

describe('toPathD and verticalLine', () => {
  it('writes M and L with one decimal and never NaN or Infinity', () => {
    const d = toPathD([[{ x: 0, y: 1.234 }, { x: 10, y: 20.05 }]]);
    assert.equal(d, 'M0.0 1.2L10.0 20.1');
    assert.doesNotMatch(toPathD(curveSegments(fn('1/x'), makeViewport(360, 360, 'standard'))), /NaN|Infinity/);
  });
  it('is empty for nothing, and starts each segment with its own M', () => {
    assert.equal(toPathD([]), '');
    assert.equal((toPathD([[{ x: 0, y: 0 }, { x: 1, y: 1 }], [{ x: 5, y: 5 }, { x: 6, y: 6 }]]).match(/M/g) ?? []).length, 2);
  });
  it('a vertical line runs the full height at the right pixel', () => {
    const vp = makeViewport(360, 360, 'standard');
    const line = verticalLine(3, vp);
    assert.equal(line.length, 2);
    close(line[0].x, toPx(vp, 3, 0).x);
    assert.equal(line[0].x, line[1].x);
    assert.equal(line[0].y, 0);
    assert.equal(line[1].y, vp.h);
  });
});

describe('findRoots', () => {
  it('finds ordinary roots', () => {
    assert.deepEqual(findRoots(fn('x^2-5x+6'), -10, 10), [2, 3]);
    assert.deepEqual(findRoots(fn('2x+1'), -10, 10), [-0.5]);
    assert.deepEqual(findRoots(fn('x^3'), -10, 10), [0]);
    assert.deepEqual(findRoots(fn('x-0.3'), -10, 10), [0.3]);
  });
  it('finds a tangential root, where the curve touches the axis without crossing', () => {
    assert.deepEqual(findRoots(fn('x^2'), -10, 10), [0]);
    assert.deepEqual(findRoots(fn('(x-1)^2'), -10, 10), [1]);
  });
  it('finds none when there are none', () => {
    assert.deepEqual(findRoots(fn('x^2+1'), -10, 10), []);
    assert.deepEqual(findRoots(fn('x^2+0.001'), -10, 10), []);
  });
  it('a pole is not a root', () => {
    assert.deepEqual(findRoots(fn('1/x'), -10, 10), []);
    assert.deepEqual(findRoots(fn('1/(x-2)'), -10, 10), []);
  });
  it('a pole between two samples is not a root either (the sign flips but the value does not vanish)', () => {
    assert.deepEqual(findRoots(fn('1/(x-0.05)'), -10, 10), []);
    assert.deepEqual(findRoots(fn('tan(x)'), -44, 404).filter(r => Math.abs(r - 90) < 5 || Math.abs(r - 270) < 5), []);
  });
  it('trigonometric roots in degrees, poles of tan excluded', () => {
    assert.deepEqual(findRoots(fn('sin(x)'), -360, 360), [-360, -180, 0, 180, 360]);
    assert.deepEqual(findRoots(fn('tan(x)'), -45, 405), [0, 180, 360]);
  });
  it('only where the function is defined', () => {
    assert.deepEqual(findRoots(fn('ln(x)'), -5, 5), [1]);
    assert.deepEqual(findRoots(fn('sqrt(x)'), -5, 5), [0]);
  });
  it('a function that is zero everywhere has no isolated roots to report', () => {
    assert.deepEqual(findRoots(fn('0*x'), -10, 10), []);
  });
  it('is sorted and capped', () => {
    const roots = findRoots(fn('sin(x)'), -3600, 3600);
    assert.ok(roots.length <= 20);
    assert.deepEqual(roots, [...roots].sort((a, b) => a - b));
  });
});

describe('findExtrema', () => {
  it('a parabola has one minimum, at the vertex', () => {
    const e = findExtrema(fn('x^2-4x+1'), -10, 10);
    assert.equal(e.length, 1);
    assert.equal(e[0].kind, 'min');
    close(e[0].x, 2);
    close(e[0].y, -3);
  });
  it('a downward parabola has a maximum', () => {
    const e = findExtrema(fn('-x^2'), -10, 10);
    assert.deepEqual(e.map(x => x.kind), ['max']);
    close(e[0].x, 0);
  });
  it('a cubic has a maximum and a minimum', () => {
    const e = findExtrema(fn('x^3-3x'), -10, 10);
    assert.deepEqual(e.map(x => [x.kind, Number(x.x.toFixed(4)), Number(x.y.toFixed(4))]), [
      ['max', -1, 2],
      ['min', 1, -2],
    ]);
  });
  it('sine in degrees peaks at 90° and bottoms at 270°', () => {
    const e = findExtrema(fn('sin(x)'), 0, 360);
    assert.deepEqual(e.map(x => [x.kind, Number(x.x.toFixed(3)), Number(x.y.toFixed(3))]), [
      ['max', 90, 1],
      ['min', 270, -1],
    ]);
  });
  it('a pole between two samples is not an extremum', () => {
    assert.deepEqual(findExtrema(fn('1/(x-0.05)'), -10, 10), []);
    assert.deepEqual(findExtrema(fn('tan(x)'), -44, 404), []);
  });
  it('monotone curves, constants and poles have none', () => {
    assert.deepEqual(findExtrema(fn('x^3'), -10, 10), []);
    assert.deepEqual(findExtrema(fn('2x+1'), -10, 10), []);
    assert.deepEqual(findExtrema(fn('4+0*x'), -10, 10), []);
    assert.deepEqual(findExtrema(fn('tan(x)'), -45, 405), []);
    assert.deepEqual(findExtrema(fn('1/x'), -10, 10), []);
  });
});

describe('findIntersections', () => {
  it('a parabola and a line', () => {
    const pts = findIntersections(fn('x^2'), fn('x+2'), -10, 10);
    assert.deepEqual(pts.map(p => [p.x, p.y]), [[-1, 1], [2, 4]]);
  });
  it('none when they do not meet', () => {
    assert.deepEqual(findIntersections(fn('x^2'), fn('-1'), -10, 10), []);
  });
  it('a tangent line touches at one point', () => {
    const pts = findIntersections(fn('x^2'), fn('2x-1'), -10, 10);
    assert.deepEqual(pts.map(p => [p.x, p.y]), [[1, 1]]);
  });
  it('sine meets cosine at 45° and 225°', () => {
    const pts = findIntersections(fn('sin(x)'), fn('cos(x)'), 0, 360);
    assert.deepEqual(pts.map(p => Number(p.x.toFixed(4))), [45, 225]);
    close(pts[0].y, Math.SQRT1_2, 1e-5);
  });
});

describe('traceAt', () => {
  it('reads the curve at x, or nothing where it is undefined', () => {
    assert.deepEqual(traceAt(fn('x^2'), 3), { x: 3, y: 9 });
    assert.equal(traceAt(fn('sqrt(x)'), -1), null);
    assert.equal(traceAt(fn('1/x'), 0), null);
  });
});
