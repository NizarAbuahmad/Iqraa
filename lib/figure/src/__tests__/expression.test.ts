import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compileExpression } from '../expression.ts';

describe('compileExpression (moved from deckVisuals)', () => {
  it('evaluates a polynomial with school notation', () => {
    const f = compileExpression('x^2 - 4')!;
    assert.equal(f(2), 0);
    assert.equal(f(0), -4);
    assert.equal(compileExpression('3x + 1')!(2), 7);
  });

  it('knows sin/cos/tan in radians and demands brackets', () => {
    assert.ok(Math.abs(compileExpression('sin(x)')!(Math.PI / 2)! - 1) < 1e-12);
    assert.equal(compileExpression('sin x + 1'), null);
  });

  it('fails closed on anything it cannot read', () => {
    assert.equal(compileExpression('y + 1'), null, 'unknown symbol');
    assert.equal(compileExpression('x; DROP'), null, 'stray characters');
    assert.equal(compileExpression('(x'), null, 'unbalanced');
    assert.equal(compileExpression(''), null);
  });
});
