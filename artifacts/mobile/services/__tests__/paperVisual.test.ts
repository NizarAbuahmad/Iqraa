import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DRAWING_IN_PDF_AR, DRAWING_IN_PDF_EN, drawingInPdfNote, paperVisualOf } from '../paperVisual.ts';

const PROJ = { kind: 'projectile', launch: 'ground', angle: 30, speed: { n: 20, unit: 'm/s' }, marks: ['v0', 'H', 'R'] };
const STEM = 'قُذفت كرة بسرعة 20 م/ث بزاوية 30° مع الأفق. احسب أقصى ارتفاع.';
const STEM_NO_SPEED = 'قُذفت كرة بزاوية 30° مع الأفق. احسب سرعتها الابتدائية.';

describe('paperVisualOf — what a paper question may show', () => {
  it('shows a drawing that passes the gate and states every number it prints', () => {
    assert.deepEqual(paperVisualOf({ text: STEM, visual: PROJ }), PROJ);
  });
  it('hides a drawing that prints a number the question does not state (re-checked at render)', () => {
    assert.equal(paperVisualOf({ text: STEM_NO_SPEED, visual: PROJ }), null);
  });
  it('hides a drawing the gate refuses, and a maths graph', () => {
    assert.equal(paperVisualOf({ text: STEM, visual: { ...PROJ, angle: 85 } }), null);
    assert.equal(paperVisualOf({ text: 'x', visual: { kind: 'function-graph', functions: [{ expr: 'x^2', label: 'f' }], x: [-2, 2] } }), null);
  });
  it('hides when there is no drawing, no text, or no question', () => {
    assert.equal(paperVisualOf({ text: STEM }), null);
    assert.equal(paperVisualOf({ visual: PROJ }), null);
    assert.equal(paperVisualOf({ text: 7, visual: PROJ }), null);
    assert.equal(paperVisualOf(null), null);
    assert.equal(paperVisualOf(undefined), null);
  });
  it('shows physics vectors whose components the question states', () => {
    const vec = { kind: 'vectors', vectors: [{ from: [0, 0], to: [3, 0], label: 'A' }, { from: [0, 0], to: [0, 4], label: 'B' }] };
    assert.ok(paperVisualOf({ text: 'قوتان A = 3 N و B = 4 N متعامدتان. احسب المحصلة.', visual: vec }));
  });
  it('hides a drawing that would give the answer away, whatever the stem says', () => {
    // A drawn sum of two waves is the superposition the question asks for.
    const wave = { kind: 'wave', cycles: 2, marks: ['A'], second: { phase: 'out', sum: true } };
    assert.equal(paperVisualOf({ text: STEM, visual: wave }), null);
    assert.equal(paperVisualOf({ text: 'موجتان متساويتان في السعة A. ارسم محصلتهما.', visual: wave }), null);
    // A drawn resultant R of A and B is the answer to «find the resultant».
    const withR = { kind: 'vectors', vectors: [
      { from: [0, 0], to: [3, 0], label: 'A' }, { from: [0, 0], to: [0, 4], label: 'B' }, { from: [0, 0], to: [3, 4], label: 'R' },
    ] };
    assert.equal(paperVisualOf({ text: 'A = 3 N و B = 4 N', visual: withR }), null);
  });
  it('the Word / text note, in each language', () => {
    assert.equal(drawingInPdfNote(true), DRAWING_IN_PDF_AR);
    assert.equal(drawingInPdfNote(false), DRAWING_IN_PDF_EN);
    assert.equal(DRAWING_IN_PDF_AR, '(الرسم في نسخة PDF)');
    assert.equal(DRAWING_IN_PDF_EN, '(The drawing is in the PDF.)');
  });
});
