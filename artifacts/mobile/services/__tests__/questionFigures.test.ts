/**
 * The take screen shows a lesson's book figures only under a question that
 * points at one. It used to show them under every question, so a spelling item
 * in a maths paper came with the maths lesson's compass rose.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { questionRefersToFigure } from '../questionFigures.ts';

describe('questionRefersToFigure', () => {
  it('is false for a spelling question', () => {
    assert.equal(questionRefersToFigure({ mode: 'choose', prompt: 'اخْتَرِ الكِتَابَةَ الصَّحيحَةَ:', options: ['ارنب', 'إرنب', 'أرنب'] }), false);
    assert.equal(questionRefersToFigure({ mode: 'write', word: 'إِسْلَام' }), false);
  });

  it('is true when the stem names a figure, vowelled or not', () => {
    assert.equal(questionRefersToFigure({ prompt: 'انظر الشكل المجاور، ما قياس الزاوية؟' }), true);
    assert.equal(questionRefersToFigure({ prompt: 'فِي الشَّكْلِ المُجَاوِرِ…' }), true);
    assert.equal(questionRefersToFigure({ prompt: 'Look at the diagram.' }), true);
  });

  it('looks inside options and nested bodies, not only the prompt', () => {
    assert.equal(questionRefersToFigure({ prompt: 'اختر', options: [{ text: 'الرسم البياني يزداد' }] }), true);
  });

  it('survives an empty or odd body', () => {
    assert.equal(questionRefersToFigure(undefined), false);
    assert.equal(questionRefersToFigure({}), false);
    assert.equal(questionRefersToFigure(null), false);
  });
});
