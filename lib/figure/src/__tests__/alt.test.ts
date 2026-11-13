import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { figureAltText } from '../alt.ts';
import { resolveFigure } from '../gate.ts';
import type { SceneFigure } from '../sceneTypes.ts';

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

describe('figureAltText: scenes', () => {
  const cases: [SceneFigure, string, string][] = [
    [{ kind: 'forces', body: 'block', incline: 30, arrows: [{ dir: 270, size: 2, label: 'W', value: { n: 49, unit: 'N' } }] },
      'مخطط قوى على جسم على سطح مائل بزاوية 30°: W = 49 N', 'Force diagram on a block on a 30° incline: W = 49 N'],
    [{ kind: 'attraction', bodies: ['m1', 'm2'], force: 'F' }, 'قوتا تجاذب F بين m1 وm2', 'Attraction forces F between m1 and m2'],
    [{ kind: 'projectile', launch: 'ground', angle: 30, marks: ['H', 'R'] }, 'مسار مقذوف أُطلق بزاوية 30° من سطح الأرض', 'Path of a projectile launched at 30° from the ground'],
    [{ kind: 'circular', turning: 'ccw', arrows: ['v', 'F'] }, 'حركة دائرية منتظمة عكس اتجاه دوران عقارب الساعة: v، F', 'Uniform circular motion, counter-clockwise: v, F'],
    [{ kind: 'wave', cycles: 2, marks: [] }, 'موجة على طولين موجيين', 'A wave over 2 wavelengths'],
  ];
  for (const [f, ar, en] of cases) {
    it(f.kind, () => {
      assert.equal(figureAltText(f, 'ar'), ar);
      assert.equal(figureAltText(f, 'en'), en);
    });
  }
});
