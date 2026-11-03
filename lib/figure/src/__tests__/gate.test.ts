import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FIGURE_LIMITS, figureConsistentWith, resolveFigure } from '../gate.ts';

const graph = (over: Record<string, unknown> = {}) => ({
  kind: 'function-graph',
  functions: [{ expr: 'x^2 - 4', label: 'f' }],
  x: [-3, 3],
  ...over,
});
const vecs = (over: Record<string, unknown> = {}) => ({
  kind: 'vectors',
  vectors: [{ from: [0, 0], to: [3, 2], label: 'u' }],
  ...over,
});

describe('resolveFigure: function-graph', () => {
  it('accepts a plain graph and fills in the defaults', () => {
    const f = resolveFigure(graph({ points: [{ at: 2, label: 'A' }], junk: 1 }));
    assert.deepEqual(f, {
      kind: 'function-graph',
      functions: [{ expr: 'x^2 - 4', label: 'f' }],
      x: [-3, 3],
      points: [{ at: 2, label: 'A', on: 0 }],
    });
  });

  it('refuses what is not an object, an unknown kind, and junk', () => {
    for (const raw of [null, undefined, 7, 'x', [], {}, { kind: 'pie' }]) {
      assert.equal(resolveFigure(raw), null, JSON.stringify(raw));
    }
  });

  it('refuses expressions the compiler cannot read, and too many or too long', () => {
    assert.equal(resolveFigure(graph({ functions: [{ expr: 'y + 1' }] })), null);
    assert.equal(resolveFigure(graph({ functions: [{ expr: 'x'.repeat(FIGURE_LIMITS.maxExprChars + 1) }] })), null);
    assert.equal(resolveFigure(graph({ functions: [] })), null);
    const four = Array.from({ length: 4 }, (_, i) => ({ expr: `x + ${i}` }));
    assert.equal(resolveFigure(graph({ functions: four })), null);
  });

  it('refuses a bad domain', () => {
    for (const x of [[3, -3], [0, 0], [-60, 0], [0, 41], [-30, 30], ['a', 1], [1], null]) {
      assert.equal(resolveFigure(graph({ x })), null, JSON.stringify(x));
    }
  });

  it('refuses a function that is mostly gaps', () => {
    assert.equal(resolveFigure(graph({ functions: [{ expr: 'sqrt(x)' }] })), null, 'unknown function');
    assert.equal(resolveFigure(graph({ functions: [{ expr: 'x/0' }] })), null, 'undefined at every sample');
  });

  it('checks the y range', () => {
    assert.ok(resolveFigure(graph({ y: [-5, 5] })));
    for (const y of [[5, -5], [0, 0], [0, 201], [-2000, 0], 'x']) {
      assert.equal(resolveFigure(graph({ y })), null, JSON.stringify(y));
    }
  });

  it('refuses a marked point off the domain, on a gap, or on a missing curve', () => {
    assert.equal(resolveFigure(graph({ points: [{ at: 5, label: 'A' }] })), null, 'outside x');
    assert.equal(resolveFigure(graph({ points: [{ at: 2, label: 'A', on: 1 }] })), null, 'no such curve');
    assert.equal(resolveFigure(graph({ functions: [{ expr: '1/x' }], x: [-1, 1], points: [{ at: 0, label: 'A' }] })), null, 'on a gap');
    const five = Array.from({ length: 5 }, (_, i) => ({ at: i - 2, label: 'P' }));
    assert.equal(resolveFigure(graph({ points: five })), null, 'too many');
  });
});

describe('labels never carry a value', () => {
  const ok = ['f', 'AB', 'ABC', 'u', 'v1', "B'", 'A′', 'س', 'ق', 'أب'];
  const bad = ['', 'ABCD', 'x=3', '(2,3)', '5', 'f(x)', 'A B', '3A', '|v|', 'A1B', 'AB12'];
  it('accepts short letter labels', () => {
    for (const label of ok) assert.ok(resolveFigure(vecs({ vectors: [{ from: [0, 0], to: [1, 1], label }] })), label);
  });
  it('refuses anything that could hold a number, coordinates or an equation', () => {
    for (const label of bad) assert.equal(resolveFigure(vecs({ vectors: [{ from: [0, 0], to: [1, 1], label }] })), null, JSON.stringify(label));
    for (const label of bad) assert.equal(resolveFigure(graph({ functions: [{ expr: 'x', label }] })), null, JSON.stringify(label));
    for (const label of bad) assert.equal(resolveFigure(graph({ points: [{ at: 0, label }] })), null, JSON.stringify(label));
  });
  it('refuses repeated curve or vector labels', () => {
    assert.equal(resolveFigure(graph({ functions: [{ expr: 'x', label: 'f' }, { expr: '2x', label: 'f' }] })), null);
    assert.equal(resolveFigure(vecs({ vectors: [{ from: [0, 0], to: [1, 1], label: 'u' }, { from: [0, 0], to: [2, 1], label: 'u' }] })), null);
  });
});

describe('resolveFigure: vectors', () => {
  it('accepts vectors and normalises', () => {
    assert.deepEqual(resolveFigure(vecs({ components: true, junk: 1 })), {
      kind: 'vectors',
      vectors: [{ from: [0, 0], to: [3, 2], label: 'u' }],
      components: true,
    });
  });
  it('refuses a zero-length vector, off-grid coordinates, big coordinates and too many', () => {
    assert.equal(resolveFigure(vecs({ vectors: [{ from: [1, 1], to: [1, 1] }] })), null);
    assert.equal(resolveFigure(vecs({ vectors: [{ from: [0, 0], to: [0.3, 1] }] })), null);
    assert.equal(resolveFigure(vecs({ vectors: [{ from: [0, 0], to: [13, 1] }] })), null);
    assert.equal(resolveFigure(vecs({ vectors: [] })), null);
    const six = Array.from({ length: 6 }, (_, i) => ({ from: [0, 0], to: [i + 1, 1] }));
    assert.equal(resolveFigure(vecs({ vectors: six })), null);
  });
  it('accepts half-unit coordinates and refuses a non-boolean components flag', () => {
    assert.ok(resolveFigure(vecs({ vectors: [{ from: [0, 0], to: [-1.5, 2.5] }] })));
    assert.equal(resolveFigure(vecs({ components: 'yes' })), null);
  });
});

describe('size', () => {
  it('refuses a spec over the byte cap', () => {
    const long = Array.from({ length: 3 }, (_, i) => ({ expr: `${'x + '.repeat(14)}${i}`, label: String.fromCharCode(102 + i) }));
    const f = resolveFigure(graph({ functions: long, points: Array.from({ length: 4 }, (_, i) => ({ at: i, label: 'P' })) }));
    assert.ok(f === null || JSON.stringify(f).length <= FIGURE_LIMITS.maxBytes);
  });
});

describe('figureConsistentWith', () => {
  const f = resolveFigure(graph())!;
  it('agrees when the checked function is one of the drawn ones', () => {
    assert.equal(figureConsistentWith(f, 'x^2 - 4'), true);
    assert.equal(figureConsistentWith(f, '-4 + x*x'), true);
  });
  it('disagrees when the checked function is a different one', () => {
    assert.equal(figureConsistentWith(f, 'x^2 - 5'), false);
  });
  it('cannot compare an equation or nothing, and then does not object', () => {
    assert.equal(figureConsistentWith(f, 'x^2 - 4 = 0'), true);
    assert.equal(figureConsistentWith(f, null), true);
    assert.equal(figureConsistentWith(f, undefined), true);
  });
  it('has nothing to say about vectors', () => {
    assert.equal(figureConsistentWith(resolveFigure(vecs())!, 'x^2'), true);
  });
});
