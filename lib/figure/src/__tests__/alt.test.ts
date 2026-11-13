import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { figureAltText } from '../alt.ts';
import { resolveFigure } from '../gate.ts';

const g = resolveFigure({ kind: 'function-graph', functions: [{ expr: 'x^2 - 4', label: 'f' }, { expr: 'sin(x)' }], x: [-3, 3] })!;
const v = resolveFigure({ kind: 'vectors', vectors: [{ from: [0, 0], to: [3, 2], label: 'u' }, { from: [1, 1], to: [-1, 2.5] }] })!;

describe('figureAltText', () => {
  it('describes a graph and shows the variable as س in Arabic only', () => {
    const ar = figureAltText(g, 'ar');
    assert.ok(ar.includes('س^2 - 4') && ar.includes('sin(س)'), ar);
    assert.ok(!/\bx\b/.test(ar), ar);
    const en = figureAltText(g, 'en');
    assert.ok(en.includes('x^2 - 4') && en.includes('f:'), en);
  });
  it('describes vectors by their end points', () => {
    const ar = figureAltText(v, 'ar');
    assert.ok(ar.includes('(0, 0)') && ar.includes('(3, 2)') && ar.includes('u'), ar);
    assert.ok(figureAltText(v, 'en').includes('(1, 1)'));
  });
});
