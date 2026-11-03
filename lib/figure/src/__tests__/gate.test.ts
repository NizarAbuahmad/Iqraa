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
  it('does not object when too few points are comparable', () => {
    // x^0.5 is finite only for x >= 0: on [-39, 1] that is 1 of the 24 samples.
    const g = resolveFigure(graph({ functions: [{ expr: 'x + 1' }], x: [-39, 1] }))!;
    assert.ok(g);
    assert.equal(figureConsistentWith(g, 'x^0.5'), true);
  });
  it('agrees when any one of several drawn functions matches', () => {
    const two = resolveFigure(graph({ functions: [{ expr: 'x^2 - 9', label: 'f' }, { expr: 'x^2 - 4', label: 'g' }] }))!;
    assert.equal(figureConsistentWith(two, 'x^2 - 4'), true);
    assert.equal(figureConsistentWith(two, 'x^2 - 5'), false);
  });
  it('has nothing to say about vectors', () => {
    assert.equal(figureConsistentWith(resolveFigure(vecs())!, 'x^2'), true);
  });
});

describe('limits that keep every renderer finishing', () => {
  it('lists the new limits', () => {
    assert.equal(FIGURE_LIMITS.minXWidth, 0.5);
    assert.equal(FIGURE_LIMITS.minYHeight, 0.1);
    assert.equal(FIGURE_LIMITS.maxSampleAbs, 1e9);
  });
  it('refuses a domain narrower than minXWidth', () => {
    for (const x of [[-50, -49.99999999999999], [0, 1e-300], [0, 0.4], [1, 1.1]]) {
      assert.equal(resolveFigure(graph({ x })), null, JSON.stringify(x));
    }
    assert.ok(resolveFigure(graph({ x: [0, 0.5] })));
  });
  it('refuses a given y range shorter than minYHeight', () => {
    for (const y of [[999.9999999999999, 1000], [0, 1e-120], [0, 0.05]]) {
      assert.equal(resolveFigure(graph({ functions: [{ expr: 'x' }], y })), null, JSON.stringify(y));
    }
    assert.ok(resolveFigure(graph({ functions: [{ expr: 'x' }], y: [0, 0.1] })));
  });
  it('refuses a function with any sample beyond maxSampleAbs', () => {
    assert.equal(resolveFigure(graph({ functions: [{ expr: '10^12 + x/10000' }], x: [-1, 1] })), null);
    assert.equal(resolveFigure(graph({ functions: [{ expr: '10^300*x' }], x: [-1, 1] })), null);
    // one huge sample among many ordinary ones still counts
    assert.equal(resolveFigure(graph({ functions: [{ expr: '2^(x*10)' }], x: [0, 40] })), null);
  });
  it('still accepts a steep but sane function', () => {
    // x:[-50,50] is 100 wide and refused by maxXWidth anyway; the widest legal domain is 40.
    assert.ok(resolveFigure(graph({ functions: [{ expr: '1000000*x' }], x: [-20, 20] })));
  });
});

describe('a marked point must be inside a given y range', () => {
  const base = { functions: [{ expr: 'x^2' }], x: [-3, 3], y: [-1, 3] };
  it('refuses a point whose y lies outside the range, accepts one inside', () => {
    assert.equal(resolveFigure(graph({ ...base, points: [{ at: 3, label: 'A' }] })), null);
    assert.ok(resolveFigure(graph({ ...base, points: [{ at: 1, label: 'A' }] })));
  });
});

describe('labels hold no number word and no tatweel', () => {
  const words = ['one', 'two', 'six', 'ten', 'Six', 'TEN', 'ten1', "six'",
    'ستة', 'عشر', 'سبع', 'مئة', 'ألف', 'الف', 'صفر', 'تسع', 'خمس', 'ثمن', 'ثلث', 'ربع', 'نصف', 'عشر2'];
  const tatweel = ['ـ', 'ـــ', 'بـ'];
  it('refuses them as a curve, point or vector label', () => {
    for (const label of [...words, ...tatweel]) {
      assert.equal(resolveFigure(vecs({ vectors: [{ from: [0, 0], to: [1, 1], label }] })), null, `vector ${label}`);
      assert.equal(resolveFigure(graph({ functions: [{ expr: 'x', label }] })), null, `curve ${label}`);
      assert.equal(resolveFigure(graph({ points: [{ at: 0, label }] })), null, `point ${label}`);
    }
  });
  it('still accepts ordinary letters', () => {
    for (const label of ['u', 'v1', "A'", 'ab', 'س', 'ق']) {
      assert.ok(resolveFigure(vecs({ vectors: [{ from: [0, 0], to: [1, 1], label }] })), label);
    }
  });
});

describe('cheap guards', () => {
  const f = resolveFigure(graph())!;
  it('figureConsistentWith tolerates a non-string question check', () => {
    assert.equal(figureConsistentWith(f, 7 as never), true);
    assert.equal(figureConsistentWith(f, {} as never), true);
  });
  it('stores vector coordinates on the half-unit grid', () => {
    const out = resolveFigure(vecs({ vectors: [{ from: [0, 0], to: [1.0000000001, 2.4999999999] }] })) as { vectors: { to: number[] }[] };
    assert.deepEqual(out.vectors[0]!.to, [1, 2.5]);
  });
  it('refuses a duplicate function or a duplicate vector', () => {
    assert.equal(resolveFigure(graph({ functions: [{ expr: 'x^2', label: 'f' }, { expr: ' x^2 ', label: 'g' }] })), null);
    assert.equal(resolveFigure(graph({ functions: [{ expr: 'x^2' }, { expr: 'x^2' }] })), null);
    const dup = { from: [0, 0], to: [1, 1] };
    assert.equal(resolveFigure(vecs({ vectors: [{ ...dup, label: 'u' }, { ...dup, label: 'v' }] })), null);
    assert.equal(resolveFigure(vecs({ vectors: [{ ...dup }, { from: [0, 0], to: [1.0000000001, 1] }] })), null);
  });
});
