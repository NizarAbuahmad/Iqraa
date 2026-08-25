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
  chartForLesson,
  compileExpression,
  extractChartData,
  curveFromCommand,
  expressionFromCommand,
  sampleCurve,
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

describe('curveFromCommand — the general form the textbook writes', () => {
  const at = (cmd: string, x: number) => curveFromCommand(cmd)?.(x) ?? null;

  it('solves an equation with y buried in the middle', () => {
    // None of these open with `y =`, which is why they used to draw nothing.
    assert.equal(at('x - y = 1', 3), 2);              // y = x - 1
    assert.equal(at('y + x = 5', 2), 3);              // y = 5 - x
    assert.equal(at('4y - 8x = -21', 2), -1.25);      // y = 2x - 5.25
    assert.equal(at('y - x^2 = 7 - 5x', 2), 1);       // y = x^2 - 5x + 7
  });

  it('reads the typographic forms the book prints', () => {
    assert.equal(at('x² + y = 4', 2), 0);
    assert.equal(at('4y − 8x = −21', 2), -1.25);
  });

  it('still takes the explicit forms', () => {
    assert.equal(at('y = 2x + 1', 3), 7);
    assert.equal(at('f(x)=x^2-5x+6', 2), 0);
  });

  it('refuses what it cannot solve rather than guessing a curve', () => {
    // Quadratic in y: the linearity guard is what stops a circle being
    // mangled into a line and projected as if it were right.
    assert.equal(curveFromCommand('x^2 + y^2 = 5'), null);
    assert.equal(curveFromCommand('y^2 = x'), null);
    // A vertical line is a real curve, but not one y = f(x) can express.
    assert.equal(curveFromCommand('x = 3'), null);
    assert.equal(curveFromCommand('the graph of the system'), null);
  });

  it('samples a solved curve into points like any other', () => {
    const f = curveFromCommand('x - y = 1')!;
    const pts = sampleCurve(f, { from: 0, to: 4, steps: 5 })!;
    assert.equal(pts.length, 5);
    assert.deepEqual(pts[0], { x: 0, y: -1 });
    assert.deepEqual(pts[4], { x: 4, y: 3 });
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

  it('accepts f, g and h as well as y', () => {
    // extractGraphCommands emits all four. A second curve on the same axes
    // (g(x)=x+1 beside f(x)=x^2) is exactly the comparison a teacher draws.
    assert.equal(expressionFromCommand('g(x)=x + 1'), 'x + 1');
    assert.equal(expressionFromCommand('h(x)=2x'), '2x');
    assert.equal(expressionFromCommand('k(x)=x'), null);
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

describe('extractChartData — what it accepts', () => {
  it('reads a labelled budget split', () => {
    const d = extractChartData(
      'وزّع الدخل الشهري كالآتي: السكن 200 دينار، الطعام 150 دينار، النقل 50 دينار، الادخار 100 دينار',
    );
    assert.deepEqual(d?.categories, ['السكن', 'الطعام', 'النقل', 'الادخار']);
    assert.deepEqual(d?.values, [200, 150, 50, 100]);
  });

  it('drops an intro phrase so the first item is not lost', () => {
    // Without this the leading item hides behind the colon, which also skews
    // a percentage split away from summing to 100 and picks the wrong chart.
    const d = extractChartData('التوزيع: السكن 10، الطعام 20، النقل 30');
    assert.equal(d?.categories.length, 3);
    assert.equal(d?.categories[0], 'السكن');
  });

  it('reads percentages and English labels', () => {
    assert.equal(extractChartData('Housing 40%, Food 30%, Transport 30%')?.values.length, 3);
  });
});

describe('extractChartData — what it refuses', () => {
  it('refuses a bare number list', () => {
    // A statistics mean exercise. Charting it gives unlabelled bars that mean
    // nothing — this is the rejection the whole extractor exists for.
    assert.equal(extractChartData('أوجد المتوسط الحسابي للبيانات: 2، 4، 6، 8'), null);
    assert.equal(extractChartData('1، 3، 3، 5، 8'), null);
  });

  it('refuses prose that merely contains numbers', () => {
    assert.equal(extractChartData('بعد 3 سنوات يصبح المبلغ 1200 دينار'), null);
    assert.equal(extractChartData('أوجد مشتقة f(x) = x^2 عند x = 3'), null);
  });

  it('refuses fewer than three items — a sentence, not a dataset', () => {
    assert.equal(extractChartData('السكن 200، الطعام 150'), null);
  });

  it('refuses a repeated label — two bars cannot both be right', () => {
    assert.equal(extractChartData('السكن 200، السكن 150، الطعام 100'), null);
  });

  it('refuses more categories than can be read from the back row', () => {
    const many = Array.from({ length: 9 }, (_, i) => `البند ${'أ'.repeat(1)}${i} ${i + 1}`).join('، ');
    assert.equal(extractChartData(many), null);
  });

  it('refuses zero and negative quantities', () => {
    assert.equal(extractChartData('السكن 0، الطعام 0، النقل 0'), null);
  });

  it('refuses single-character labels — those are variables, not categories', () => {
    // «س 5، ص 10، ع 15» is algebra, not a dataset.
    assert.equal(extractChartData('س 5، ص 10، ع 15'), null);
  });

  it('refuses empty input', () => {
    assert.equal(extractChartData(''), null);
  });
});

describe('chartForLesson', () => {
  it('uses a pie when the values are shares of a whole', () => {
    const c = chartForLesson('النسب: السكن 40%، الطعام 30%، النقل 10%، الادخار 20%');
    assert.equal(c?.kind, 'chart');
    assert.equal(c && c.kind === 'chart' ? c.chartType : null, 'pie');
  });

  it('uses bars for amounts that are not shares', () => {
    const c = chartForLesson('السكن 200 دينار، الطعام 150 دينار، النقل 50 دينار');
    assert.equal(c && c.kind === 'chart' ? c.chartType : null, 'bar');
  });

  it('uses bars for percentages that do not sum to a whole', () => {
    // Three unrelated rates are not parts of one pie.
    const c = chartForLesson('نمو 5%، تضخم 3%، فائدة 7%');
    assert.equal(c && c.kind === 'chart' ? c.chartType : null, 'bar');
  });

  it('returns null when there is no dataset', () => {
    assert.equal(chartForLesson('أوجد المتوسط الحسابي للبيانات: 2، 4، 6'), null);
  });
});
