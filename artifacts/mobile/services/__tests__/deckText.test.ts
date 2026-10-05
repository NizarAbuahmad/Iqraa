/**
 * deckText.ts — the line rules the presenter and both exports share.
 *
 * They are here because they used to be three private copies: the screen lifted
 * a heading's leading emoji into a chip, the PDF printed it twice, and the
 * PowerPoint export had no notion of a bullet at all.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  isBulletLine, isEnglishSlideContent, looksLikeEquation, splitEmoji, stripBullet,
} from '../deckText.ts';

describe('splitEmoji', () => {
  it('lifts a leading section emoji off an Arabic heading', () => {
    assert.deepEqual(splitEmoji('🎯 نتاجات التعلم'), ['🎯', 'نتاجات التعلم']);
  });

  it('leaves a heading that starts with a word alone', () => {
    assert.deepEqual(splitEmoji('نتاجات التعلم'), ['', 'نتاجات التعلم']);
  });

  it('drops the variation selector trailing an emoji', () => {
    assert.deepEqual(splitEmoji('🖼️ صورة'), ['🖼', 'صورة']);
  });
});

describe('bullets', () => {
  it('recognises the markers the generators actually write', () => {
    assert.equal(isBulletLine('• استعمال جيوجبرا'), true);
    assert.equal(isBulletLine('- use GeoGebra'), true);
    assert.equal(isBulletLine('حل النظام بيانيًا'), false);
  });

  it('strips only the marker', () => {
    assert.equal(stripBullet('• حل النظام'), 'حل النظام');
    assert.equal(stripBullet('حل النظام'), 'حل النظام');
  });
});

describe('looksLikeEquation', () => {
  it('spots maths that deserves its own box', () => {
    assert.equal(looksLikeEquation('y = x^2 - 3x + 2'), true);
    assert.equal(looksLikeEquation('√25 = 5'), true);
  });

  it('never boxes a bullet, even one carrying an x', () => {
    // A list item mentioning a variable is still a list item — boxing it turns
    // a learning objective into a centred 26px formula.
    assert.equal(looksLikeEquation('• أوجد قيمة x من المعادلة'), false);
  });

  it('leaves prose as prose', () => {
    assert.equal(looksLikeEquation('اكتب ملاحظاتك في الدفتر'), false);
  });
});

describe('isEnglishSlideContent', () => {
  // The reported case: an English-subject exit-ticket check comes back from
  // the model in English while the surrounding deck was built with the app's
  // UI in Arabic. The projector must not right-align this and letter its
  // options أبجد.
  it('flags a plain English question and options', () => {
    assert.equal(
      isEnglishSlideContent(
        'Which action is the most logical if a website does not load?',
        'Check the internet connection and refresh the page',
        'Change the computer theme',
      ),
      true,
    );
  });

  it('keeps Arabic prose Arabic, even with an embedded equation', () => {
    assert.equal(isEnglishSlideContent('إذا كان f(x) = 2x + 3، فأوجد f(2)'), false);
  });

  it('keeps Arabic options Arabic', () => {
    assert.equal(isEnglishSlideContent('حل المعادلة', 'أ) 3', 'ب) 5'), false);
  });

  it('has no opinion on an empty or purely numeric payload', () => {
    assert.equal(isEnglishSlideContent(''), false);
    assert.equal(isEnglishSlideContent('42', '3.14'), false);
  });
});

import { workingSteps } from '../deckText.ts';

describe('workingSteps', () => {
  it('splits the book’s working chain into steps and the result', () => {
    assert.deepEqual(
      workingSteps('2x−5 = x²−5x+7 → x²−7x+12=0 → x=3 أو x=4'),
      { steps: ['2x−5 = x²−5x+7', 'x²−7x+12=0'], final: 'x=3 أو x=4' },
    );
  });

  it('splits a single arrow too, and on the other arrow spellings', () => {
    assert.deepEqual(workingSteps('x² = 9 → x = 3'), { steps: ['x² = 9'], final: 'x = 3' });
    assert.deepEqual(workingSteps('a = 1 ⇒ b = 2'), { steps: ['a = 1'], final: 'b = 2' });
    assert.deepEqual(workingSteps('a = 1 => b = 2'), { steps: ['a = 1'], final: 'b = 2' });
  });

  it('leaves an answer with no arrow alone', () => {
    assert.equal(workingSteps('x=4 أو x=3'), null);
  });

  it('does not split a chemical reaction — an arrow is not always working', () => {
    assert.equal(workingSteps('N₂ + 3H₂ → 2NH₃'), null);
  });

  it('refuses when any part is not itself an equation or inequality', () => {
    assert.equal(workingSteps('x = 4 → 7'), null);
    assert.equal(workingSteps('→ x = 4'), null);
  });

  it('refuses a chain longer than the renderers have room for', () => {
    assert.equal(workingSteps('a=1 → b=2 → c=3 → d=4 → e=5 → f=6'), null);
    assert.ok(workingSteps('a=1 → b=2 → c=3 → d=4 → e=5'), 'five parts is the limit');
  });
});
