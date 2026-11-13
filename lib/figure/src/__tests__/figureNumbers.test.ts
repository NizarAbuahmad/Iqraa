import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { figureNumbers, figureNumbersInText, foldDigits } from '../figureNumbers.ts';
import type { PhysicsFigure } from '../sceneTypes.ts';

const proj: PhysicsFigure = { kind: 'projectile', launch: 'ground', angle: 30, speed: { n: 20, unit: 'm/s' }, marks: ['v0', 'H', 'R'] };
const slope: PhysicsFigure = { kind: 'forces', body: 'block', incline: 37, arrows: [{ dir: 270, size: 2, label: 'W', value: { n: 49, unit: 'N' } }] };

describe('foldDigits', () => {
  it('turns Arabic-Indic and Persian digits into Latin, and «٫» between digits into a point', () => {
    assert.equal(foldDigits('٢٠ م/ث'), '20 م/ث');
    assert.equal(foldDigits('۴۵'), '45');
    assert.equal(foldDigits('٩٫٨'), '9.8');
    assert.equal(foldDigits('٩،٨'), '9.8');
    assert.equal(foldDigits('20، 30'), '20، 30');
  });
});

describe('figureNumbers', () => {
  it('lists every number the drawing prints', () => {
    assert.deepEqual(figureNumbers(proj), [30, 20]);
    assert.deepEqual(figureNumbers(slope), [37, 49]);
    assert.deepEqual(figureNumbers({ kind: 'wave', cycles: 2, marks: ['A'], amplitude: { n: 0.05, unit: 'm' }, wavelength: { n: 2, unit: 'm' } }), [0.05, 2]);
    assert.deepEqual(figureNumbers({ kind: 'circular', turning: 'cw', arrows: ['v'] }), []);
    assert.deepEqual(figureNumbers({ kind: 'vectors', vectors: [{ from: [0, 0], to: [3, 2] }] }), []);
  });
});

describe('figureNumbersInText', () => {
  it('passes when every printed number is in the question, in either digit system', () => {
    assert.equal(figureNumbersInText(proj, 'قُذفت كرة بسرعة 20 م/ث بزاوية 30° مع الأفق. احسب أقصى ارتفاع.'), true);
    assert.equal(figureNumbersInText(proj, 'قُذفت كرة بسرعة ٢٠ م/ث بزاوية ٣٠° مع الأفق.'), true);
    assert.equal(figureNumbersInText({ kind: 'wave', cycles: 1, marks: ['A'], amplitude: { n: 9.8, unit: 'm' } }, 'سعتها ٩٫٨ م'), true);
    assert.equal(figureNumbersInText(proj, 'A ball is thrown at 20.0 m/s at 30 degrees.'), true);
  });

  it('fails when the drawing shows a number the question does not state', () => {
    assert.equal(figureNumbersInText(proj, 'قُذفت كرة بسرعة 25 م/ث بزاوية 30°.'), false);
    assert.equal(figureNumbersInText(slope, 'جسم على سطح مائل بزاوية 37°.'), false);
    assert.equal(figureNumbersInText(proj, 'قُذفت كرة بسرعة 120 م/ث بزاوية 130°.'), false);
  });

  it('a drawing that prints no number always passes', () => {
    assert.equal(figureNumbersInText({ kind: 'circular', turning: 'ccw', arrows: ['v', 'F'] }, 'جسم يتحرك حركة دائرية.'), true);
  });
});
