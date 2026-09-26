import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyForm, formFromQuestion, isEditableQuestion, payloadFromForm } from '../questionDraft.ts';

test('multiple choice: blank options are dropped and the correct mark follows its option', () => {
  const form = { ...emptyForm(), prompt: 'كم ٢+٢؟', options: ['3', '', '4', '5'], correct: [2] };
  const p = payloadFromForm('multiple_choice', form, 1);
  assert.deepEqual(p.body['options'], [
    { id: 'a', text: '3' },
    { id: 'b', text: '4' },
    { id: 'c', text: '5' },
  ]);
  assert.deepEqual(p.expectedAnswer['optionIds'], ['b']);
});

test('fill blank: ____ gaps become numbered tokens and round-trip', () => {
  const form = { ...emptyForm(), prompt: 'عاصمة الأردن ____ وتقع في ____.', blanks: ['عمان / عمّان', 'آسيا'] };
  const p = payloadFromForm('fill_blank', form, 2);
  assert.equal(p.body['template'], 'عاصمة الأردن {{1}} وتقع في {{2}}.');
  assert.deepEqual(p.expectedAnswer['blanks'], [{ accept: ['عمان', 'عمّان'] }, { accept: ['آسيا'] }]);
  const back = formFromQuestion({ type: 'fill_blank', ...p });
  assert.equal(back.prompt, form.prompt);
  assert.deepEqual(back.blanks, ['عمان / عمّان', 'آسيا']);
});

test('matching: a row with no left side is a right-hand distractor', () => {
  const form = {
    ...emptyForm(),
    pairs: [{ left: 'H2O', right: 'ماء' }, { left: 'NaCl', right: 'ملح' }, { left: '', right: 'سكر' }],
  };
  const p = payloadFromForm('matching', form, 2);
  assert.equal((p.body['left'] as unknown[]).length, 2);
  assert.equal((p.body['right'] as unknown[]).length, 3);
  assert.deepEqual(p.expectedAnswer['pairs'], [{ left: 'l1', right: 'r1' }, { left: 'l2', right: 'r2' }]);
  assert.deepEqual(formFromQuestion({ type: 'matching', ...p }).pairs, form.pairs);
});

test('open question: new gets a rubric from key concepts, edit keeps stored fields', () => {
  const form = { ...emptyForm(), prompt: 'اشرح', modelAnswer: 'لأن…', list: 'السبب\nالنتيجة' };
  const fresh = payloadFromForm('open_ended', form, 4);
  assert.deepEqual(fresh.rubric, { criteria: [{ label: 'السبب', marks: 2 }, { label: 'النتيجة', marks: 2 }] });

  const existing = { body: { prompt: 'قديم', extra: 1 }, expectedAnswer: { modelAnswer: 'x', keyConcepts: ['y'] } };
  const edited = payloadFromForm('open_ended', form, 4, existing);
  assert.equal(edited.rubric, undefined);
  assert.deepEqual(edited.body, { prompt: 'اشرح', extra: 1 });
});

test('paper-grid rows and read-aloud are not editable here', () => {
  assert.equal(isEditableQuestion({ type: 'open_ended', body: {} }), false);
  assert.equal(isEditableQuestion({ type: 'read_aloud', body: { passage: 'x' } }), false);
  assert.equal(isEditableQuestion({ type: 'true_false', body: { statement: 'x' } }), true);
});
