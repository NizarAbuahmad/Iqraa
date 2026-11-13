import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { figureNumbers, figureNumbersInText, foldDigits, vectorsShowResult } from '../figureNumbers.ts';
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
    assert.deepEqual(figureNumbers({ kind: 'vectors', vectors: [{ from: [0, 0], to: [3, 2] }, { from: [1, 1], to: [1, 3.5] }] }), [3, 2, 2.5, 1, 3.5]);
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

  it('a digit inside a symbol (F2, m1, v0) is not a stated number', () => {
    const two: PhysicsFigure = { kind: 'forces', body: 'point', arrows: [
      { dir: 0, size: 3, label: 'F1', value: { n: 3, unit: 'N' } },
      { dir: 90, size: 2, label: 'F2', value: { n: 2, unit: 'N' } },
    ] };
    assert.equal(figureNumbersInText(two, 'تؤثر قوتان F1 = 3 N و F2 في جسم. احسب F2.'), false);
    const pull: PhysicsFigure = { kind: 'attraction', bodies: ['m1', 'm2'], force: 'F', distance: { label: 'r', value: { n: 1, unit: 'm' } } };
    assert.equal(figureNumbersInText(pull, 'كتلتان m1 و m2، احسب المسافة r بينهما.'), false);
    const ledge: PhysicsFigure = { kind: 'projectile', launch: 'horizontal', height: { n: 0, unit: 'm' }, marks: ['v0'] };
    assert.equal(figureNumbersInText(ledge, 'قُذف جسم أفقيًا بسرعة v0 من حافة.'), false);
  });

  it('a number joined to a word by tatweel still counts («بـ20»)', () => {
    const fast: PhysicsFigure = { kind: 'projectile', launch: 'horizontal', speed: { n: 20, unit: 'm/s' }, marks: ['v0'] };
    assert.equal(figureNumbersInText(fast, 'قُذف جسم أفقيًا بـ20 م/ث من حافة.'), true);
  });

  it('a drawing that prints no number always passes', () => {
    assert.equal(figureNumbersInText({ kind: 'circular', turning: 'ccw', arrows: ['v', 'F'] }, 'جسم يتحرك حركة دائرية.'), true);
  });
});

describe('vectors on the numbered grid', () => {
  const two = { kind: 'vectors' as const, vectors: [{ from: [0, 0] as [number, number], to: [3, 0] as [number, number], label: 'A' }, { from: [0, 0] as [number, number], to: [0, 4] as [number, number], label: 'B' }] };
  it('passes only when every non-zero component is stated', () => {
    assert.equal(figureNumbersInText(two, 'قوتان A = 3 N شرقًا و B = 4 N شمالًا. احسب المحصلة.'), true);
    assert.equal(figureNumbersInText(two, 'قوتان متعامدتان. احسب مقدار المحصلة.'), false);
  });
  it('refuses a drawn sum or difference of two drawn vectors', () => {
    const tipToTail = { kind: 'vectors' as const, vectors: [
      { from: [0, 0] as [number, number], to: [3, 0] as [number, number], label: 'A' },
      { from: [3, 0] as [number, number], to: [3, 4] as [number, number], label: 'B' },
      { from: [0, 0] as [number, number], to: [3, 4] as [number, number], label: 'R' },
    ] };
    assert.equal(vectorsShowResult(tipToTail), true);
    assert.equal(figureNumbersInText(tipToTail, 'A = 3 و B = 4، احسب R'), false);
    const diff = { kind: 'vectors' as const, vectors: [
      { from: [0, 0] as [number, number], to: [3, 1] as [number, number] },
      { from: [0, 0] as [number, number], to: [1, 1] as [number, number] },
      { from: [1, 1] as [number, number], to: [3, 1] as [number, number] },
    ] };
    assert.equal(vectorsShowResult(diff), true);
    assert.equal(vectorsShowResult(two), false);
  });

  type P = [number, number];
  const vec = (from: P, to: P, label?: string) => (label ? { from, to, label } : { from, to });
  const sumStem = 'A = 3i + 1j و B = 2i + 3j. أوجد مركّبتي المحصلة A + B.';

  it('counts the end points: a tip-to-tail chain prints the resultant at its tip', () => {
    const chain = { kind: 'vectors' as const, vectors: [vec([0, 0], [3, 1], 'A'), vec([3, 1], [5, 4], 'B')] };
    assert.equal(figureNumbersInText(chain, sumStem), false);
  });

  it('the same two vectors drawn from the origin pass', () => {
    const fromOrigin = { kind: 'vectors' as const, vectors: [vec([0, 0], [3, 1], 'A'), vec([0, 0], [2, 3], 'B')] };
    assert.equal(figureNumbersInText(fromOrigin, sumStem), true);
  });

  it('refuses an equilibrant and a resultant of three vectors', () => {
    const equilibrant = { kind: 'vectors' as const, vectors: [vec([0, 0], [3, 0], 'A'), vec([0, 0], [0, 4], 'B'), vec([0, 0], [-3, -4], 'E')] };
    assert.equal(vectorsShowResult(equilibrant), true);
    const three = { kind: 'vectors' as const, vectors: [vec([0, 0], [1, 0], 'A'), vec([0, 0], [0, 2], 'B'), vec([0, 0], [3, 0], 'C'), vec([0, 0], [4, 2], 'R')] };
    assert.equal(vectorsShowResult(three), true);
  });

  it('a vector and its opposite alone are not a sum (one non-zero coefficient)', () => {
    const opposite = { kind: 'vectors' as const, vectors: [vec([0, 0], [2, 0], 'A'), vec([0, 0], [-2, 0], 'B')] };
    assert.equal(vectorsShowResult(opposite), false);
  });

  it('fails a partly stated pair, reads Arabic-Indic digits, and compares half units exactly', () => {
    assert.equal(figureNumbersInText(two, 'A = 3 N فقط'), false);
    assert.equal(figureNumbersInText(two, 'قوتان A = ٣ N و B = ٤ N'), true);
    const half = { kind: 'vectors' as const, vectors: [vec([0, 0], [1.5, 0], 'A')] };
    assert.equal(figureNumbersInText(half, 'A = 1.5 N'), true);
    assert.equal(figureNumbersInText(half, 'A = 1 N'), false);
  });
});

describe('a drawn wave sum', () => {
  const wave: PhysicsFigure & { kind: 'wave' } = { kind: 'wave', cycles: 2, marks: ['A'], amplitude: { n: 0.5, unit: 'm' } };
  it('always fails: the sum is the answer', () => {
    assert.equal(figureNumbersInText({ ...wave, second: { phase: 'out', sum: true } }, 'موجتان سعة كل منهما 0.5 m. ارسم مجموعهما.'), false);
  });
  it('a second wave without its sum is judged by its numbers', () => {
    assert.equal(figureNumbersInText({ ...wave, second: { phase: 'out', sum: false } }, 'موجتان سعة كل منهما 0.5 m.'), true);
    assert.equal(figureNumbersInText({ ...wave, second: { phase: 'out', sum: false } }, 'موجتان متعاكستان في الطور.'), false);
  });
});
