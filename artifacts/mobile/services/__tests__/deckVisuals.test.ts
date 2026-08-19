/**
 * The visual spec every renderer draws from.
 *
 * The evaluator is the risky part: it decides what curve appears on a
 * classroom wall. It is deliberately tiny and fails closed, and these tests
 * pin both halves of that — that it gets school arithmetic right, and that it
 * refuses anything it cannot be sure of instead of guessing.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  compileExpression,
  expressionFromCommand,
  isRenderableVisual,
  plotGeometry,
  samplePlot,
  visualToSvg,
  type VisualBlock,
} from '../deckVisuals.ts';

const at = (src: string, x: number) => compileExpression(src)?.(x);

describe('compileExpression — school arithmetic', () => {
  it('evaluates polynomials', () => {
    assert.equal(at('x^2', 3), 9);
    assert.equal(at('x^3-4x', 2), 0);
    assert.equal(at('x^2-5x+6', 2), 0);
    assert.equal(at('x/2', 9), 4.5);
  });

  it('reads the implicit multiplication school notation uses', () => {
    assert.equal(at('3x', 4), 12);
    assert.equal(at('2(x+1)', 4), 10);
    assert.equal(at('2x(x+1)', 2), 12);
  });

  it('honours operator precedence', () => {
    assert.equal(at('2+3*4', 0), 14);
    assert.equal(at('(2+3)*4', 0), 20);
  });

  it('treats ^ as right-associative, as maths does', () => {
    // 2^(3^2) = 512, not (2^3)^2 = 64.
    assert.equal(at('2^3^2', 0), 512);
  });

  it('applies unary minus to the power, not the base', () => {
    // -x² at 3 is -9. (-x)² would be 9 and would plot the wrong parabola.
    assert.equal(at('-x^2', 3), -9);
    assert.equal(at('-3+x', 1), -2);
  });
});

describe('compileExpression — fails closed', () => {
  it('refuses functions it cannot evaluate', () => {
    for (const src of ['sin(x)', 'log(x)', 'sqrt(x)']) {
      assert.equal(compileExpression(src), null, src);
    }
  });

  it('refuses unbalanced parentheses', () => {
    assert.equal(compileExpression('2(x+1'), null);
    assert.equal(compileExpression('2x+1)'), null);
  });

  it('refuses a second unknown — a surface, not a curve', () => {
    assert.equal(compileExpression('x+y'), null);
  });

  it('refuses malformed numbers and empty input', () => {
    assert.equal(compileExpression('1.2.3'), null);
    assert.equal(compileExpression(''), null);
    assert.equal(compileExpression('   '), null);
  });
});

describe('samplePlot', () => {
  it('samples across the range', () => {
    const pts = samplePlot('x^2', { from: -3, to: 3, steps: 7 });
    assert.equal(pts?.length, 7);
    assert.equal(pts?.[0]!.x, -3);
    assert.equal(pts?.[0]!.y, 9);
  });

  it('drops non-finite points instead of clamping them', () => {
    // 1/x has no value at 0; the curve should have a gap, not a fake spike.
    const pts = samplePlot('1/x', { from: -2, to: 2, steps: 5 });
    assert.ok(pts);
    assert.ok(pts.every(p => Number.isFinite(p.y)));
    assert.ok(pts.every(p => p.x !== 0));
  });

  it('returns null when nothing plottable survives', () => {
    assert.equal(samplePlot('sin(x)'), null);
    assert.equal(samplePlot('x^2', { from: 5, to: 5 }), null);
  });
});

describe('expressionFromCommand', () => {
  it('takes the right-hand side of a definition', () => {
    assert.equal(expressionFromCommand('f(x)=x^2-5x+6'), 'x^2-5x+6');
    assert.equal(expressionFromCommand('y = 2x + 1'), '2x + 1');
  });

  it('normalises the typography the books use', () => {
    assert.equal(expressionFromCommand('f(x)=x²−4'), 'x^2-4');
  });

  it('returns null for commands it cannot plot', () => {
    assert.equal(expressionFromCommand('f(x)=sin(x)'), null);
    assert.equal(expressionFromCommand('Circle((0,0),3)'), null);
    assert.equal(expressionFromCommand('f(x)=7'), null); // no x — a constant, nothing to show
  });
});

describe('plotGeometry', () => {
  const block = (points: { x: number; y: number }[]): VisualBlock =>
    ({ kind: 'plot', series: [{ label: 'f', points }] });

  it('maps into pixel space with y flipped for screen coordinates', () => {
    const g = plotGeometry(block([{ x: 0, y: 0 }, { x: 1, y: 1 }]) as never, 200, 200, 20);
    assert.ok(g);
    const [lo, hi] = g.series[0]!.points;
    assert.equal(lo!.x, 20);
    assert.equal(lo!.y, 180); // y = 0 sits at the BOTTOM
    assert.equal(hi!.y, 20);  // y = 1 at the top
  });

  it('places axes only when zero is inside the range', () => {
    const through = plotGeometry(block([{ x: -1, y: -1 }, { x: 1, y: 1 }]) as never, 200, 200, 20);
    assert.ok(through!.axisX !== null && through!.axisY !== null);

    const away = plotGeometry(block([{ x: 5, y: 5 }, { x: 9, y: 9 }]) as never, 200, 200, 20);
    assert.equal(away!.axisX, null);
    assert.equal(away!.axisY, null);
  });

  it('does not divide by zero on a flat line', () => {
    const g = plotGeometry(block([{ x: 0, y: 3 }, { x: 4, y: 3 }]) as never, 200, 200, 20);
    assert.ok(g);
    assert.ok(g.series[0]!.points.every(p => Number.isFinite(p.y)));
  });

  it('returns null when there is nothing to draw', () => {
    assert.equal(plotGeometry(block([{ x: 0, y: 0 }]) as never, 200, 200), null);
  });
});

describe('isRenderableVisual', () => {
  it('accepts the kinds this build can draw', () => {
    assert.equal(isRenderableVisual({ kind: 'plot', series: [] }), true);
    assert.equal(isRenderableVisual({ kind: 'chart', chartType: 'bar', categories: [], values: [] }), true);
  });

  it('rejects undefined and kinds from a future build', () => {
    // A deck saved by a later version must not crash an older export path.
    assert.equal(isRenderableVisual(undefined), false);
    assert.equal(isRenderableVisual({ kind: 'flow' } as never), false);
  });
});

describe('visualToSvg', () => {
  it('draws the curve where the maths actually puts it', () => {
    // x²-5x+6 has its vertex at x = 2.5. On screen the minimum of the curve
    // must be the LARGEST y pixel, because SVG y grows downward. Getting this
    // backwards would project an upside-down parabola, which looks plausible
    // enough that nobody would question it.
    const points = samplePlot('x^2-5x+6', { from: -1, to: 6, steps: 71 })!;
    const g = plotGeometry({ kind: 'plot', series: [{ label: 'f', points }] }, 640, 340)!;
    const drawn = g.series[0]!.points;
    const lowest = drawn.reduce((a, b) => (a.y > b.y ? a : b));
    const vertexIdx = points.findIndex(p => Math.abs(p.x - 2.5) < 0.06);
    assert.ok(vertexIdx >= 0, 'sample should include the vertex');
    assert.ok(
      Math.abs(lowest.x - drawn[vertexIdx]!.x) < 1,
      'the on-screen minimum should sit at the vertex',
    );
  });

  it('emits a polyline and both axes for a plot spanning the origin', () => {
    const points = samplePlot('x^2-4', { from: -3, to: 3, steps: 30 })!;
    const svg = visualToSvg({ kind: 'plot', series: [{ label: 'f', points }] });
    assert.match(svg, /<polyline/);
    assert.equal((svg.match(/<line/g) ?? []).length, 2);
  });

  it('draws one bar per category and labels it', () => {
    const svg = visualToSvg({
      kind: 'chart', chartType: 'bar',
      categories: ['سكن', 'طعام', 'نقل'], values: [400, 250, 150],
    });
    assert.equal((svg.match(/<rect/g) ?? []).length, 3);
    assert.match(svg, /سكن/);
  });

  it('draws one slice per pie value', () => {
    const svg = visualToSvg({
      kind: 'chart', chartType: 'pie', categories: ['a', 'b', 'c'], values: [3, 1, 1],
    });
    assert.equal((svg.match(/<path/g) ?? []).length, 3);
  });

  it('escapes category text rather than letting it break the markup', () => {
    const svg = visualToSvg({
      kind: 'chart', chartType: 'bar', categories: ['<script>'], values: [1],
    });
    assert.ok(!svg.includes('<script>'));
    assert.match(svg, /&lt;script&gt;/);
  });

  it('returns empty string for anything it cannot draw', () => {
    // The open-union contract: an older export path must silently omit a block
    // kind a later build introduced, not throw on the teacher's saved deck.
    assert.equal(visualToSvg({ kind: 'flow' } as never), '');
    assert.equal(visualToSvg({ kind: 'plot', series: [] }), '');
    assert.equal(visualToSvg({ kind: 'chart', chartType: 'bar', categories: [], values: [] }), '');
    assert.equal(visualToSvg({ kind: 'chart', chartType: 'bar', categories: ['a'], values: [0] }), '');
  });
});
