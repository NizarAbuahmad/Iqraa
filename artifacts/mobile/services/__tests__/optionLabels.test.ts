/**
 * Option lettering for exports.
 *
 * The regression these guard is a printed exam paper reading "أ) الوقت A." —
 * the generator's own marker plus ours, in two scripts. Both halves matter:
 * stripping without lettering leaves options unlabelled, and lettering without
 * stripping is what shipped.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  labelAnswer,
  labelOption,
  labelOptionLine,
  normalizeQuestionOptions,
  optionLetter,
  stripOptionPrefix,
} from '../optionLabels.ts';

describe('optionLetter', () => {
  it('letters Arabic options in abjad order, not alphabetical', () => {
    const letters = [0, 1, 2, 3].map(i => optionLetter(i, true));
    assert.deepEqual(letters, ['أ', 'ب', 'ج', 'د']);
  });

  it('keeps A/B/C/D for English exports', () => {
    assert.deepEqual([0, 1, 2, 3].map(i => optionLetter(i, false)), ['A', 'B', 'C', 'D']);
  });

  it('falls back to a number past the abjad list rather than printing undefined', () => {
    assert.equal(optionLetter(10, true), '11');
  });
});

describe('stripOptionPrefix', () => {
  it('drops the Arabic marker the model baked into the text', () => {
    assert.equal(stripOptionPrefix('أ) الوقت'), 'الوقت');
    assert.equal(stripOptionPrefix('د) جميع ما سبق'), 'جميع ما سبق');
    assert.equal(stripOptionPrefix('ب- الجهد البشري'), 'الجهد البشري');
    assert.equal(stripOptionPrefix('هـ. المال'), 'المال');
  });

  it('drops latin and numeric markers too — models mix scripts', () => {
    assert.equal(stripOptionPrefix('A. Time'), 'Time');
    assert.equal(stripOptionPrefix('3) الجهد'), 'الجهد');
    assert.equal(stripOptionPrefix('٢. المال'), 'المال');
  });

  it('leaves an unmarked option alone', () => {
    assert.equal(stripOptionPrefix('صح'), 'صح');
    assert.equal(stripOptionPrefix('تحديد المعطيات والمطلوب بدقة'), 'تحديد المعطيات والمطلوب بدقة');
  });

  it('does not eat a leading واو that is the word "and", not option (و)', () => {
    assert.equal(stripOptionPrefix('و الوقت معًا'), 'و الوقت معًا');
  });

  it('does not eat a leading parenthesis that is part of the answer', () => {
    assert.equal(stripOptionPrefix('(2, 5)'), '(2, 5)');
  });

  it('keeps the original when stripping would leave nothing', () => {
    assert.equal(stripOptionPrefix('أ)'), 'أ)');
  });
});

describe('labelOption', () => {
  it('re-letters an option the model already lettered — one marker, not two', () => {
    assert.deepEqual(labelOption('أ) الوقت', 0, true), { letter: 'أ.', text: 'الوقت' });
  });

  it('letters a bare option from the mock generator', () => {
    assert.deepEqual(labelOption('الوقت', 0, true), { letter: 'أ.', text: 'الوقت' });
  });

  it('renumbers when the model letters options out of order', () => {
    // A model that emits "ج) …" first must still print as option أ, or the
    // answer key (which is index-based) points at the wrong line.
    assert.deepEqual(labelOption('ج) المال', 0, true), { letter: 'أ.', text: 'المال' });
  });

  it('uses . rather than ) — a paren is bidi-mirrored inside an RTL run', () => {
    assert.equal(labelOption('الوقت', 0, true).letter.endsWith('.'), true);
  });
});

describe('labelOptionLine', () => {
  it('joins marker and text for plain-text exports', () => {
    assert.equal(labelOptionLine('أ) الوقت', 0, true), 'أ. الوقت');
    assert.equal(labelOptionLine('Time', 1, false), 'B. Time');
  });
});

describe('labelAnswer', () => {
  const opts = ['أ) الوقت', 'ب) الجهد البشري', 'ج) المال', 'د) جميع ما سبق'];

  it('letters the key from the option position, matching the printed paper', () => {
    assert.equal(labelAnswer(opts, 'د) جميع ما سبق', true), 'د. جميع ما سبق');
  });

  it('matches on text when the key carries no marker of its own', () => {
    assert.equal(labelAnswer(opts, 'المال', true), 'ج. المال');
  });

  it("re-letters when the model's own marker disagrees with option order", () => {
    // The paper prints المال as (ج) because it is third. A key saying "أ) المال"
    // would send the teacher to the wrong line.
    assert.equal(labelAnswer(opts, 'أ) المال', true), 'ج. المال');
  });

  it('leaves a short-answer key alone — there are no options to letter', () => {
    const prose = 'مراقبة سير العمل والتأكد من تنفيذ المهام وفق الخطة';
    assert.equal(labelAnswer(undefined, prose, true), prose);
    assert.equal(labelAnswer([], prose, true), prose);
  });

  it('shows the answer verbatim when it matches no option, rather than guessing', () => {
    assert.equal(labelAnswer(opts, 'الميزانية', true), 'الميزانية');
  });

  it('letters true/false keys too', () => {
    assert.equal(labelAnswer(['صح', 'خطأ'], 'خطأ', true), 'ب. خطأ');
  });
});

describe('normalizeQuestionOptions', () => {
  const q = () => ({
    id: 'q7',
    type: 'multiple_choice',
    options: ['أ) الوقت', 'ب) الجهد البشري', 'ج) المال', 'د) جميع ما سبق'],
    correctAnswer: 'د) جميع ما سبق',
    points: 2,
  });

  it('strips the generator markers from every option', () => {
    assert.deepEqual(normalizeQuestionOptions(q()).options, [
      'الوقت', 'الجهد البشري', 'المال', 'جميع ما سبق',
    ]);
  });

  it('keeps correctAnswer pointing at a real option', () => {
    const out = normalizeQuestionOptions(q());
    assert.equal(out.correctAnswer, 'جميع ما سبق');
    assert.ok(out.options!.includes(out.correctAnswer!),
      'a key that matches no option leaves the question with no correct choice');
  });

  it('carries the answer across by position, not by re-stripping', () => {
    // Two options whose stripped text would collide if matched by text alone.
    const out = normalizeQuestionOptions({
      options: ['أ) صح', 'ب) صح'],
      correctAnswer: 'ب) صح',
    });
    assert.equal(out.options![1], 'صح');
    assert.equal(out.correctAnswer, 'صح');
  });

  it('preserves every other field on the question', () => {
    const out = normalizeQuestionOptions(q());
    assert.equal(out.id, 'q7');
    assert.equal(out.type, 'multiple_choice');
    assert.equal(out.points, 2);
  });

  it('leaves an options-free question untouched', () => {
    const short = { id: 'q8', correctAnswer: 'مراقبة سير العمل' };
    assert.deepEqual(normalizeQuestionOptions(short), short);
  });

  it('is idempotent — re-normalising saved material changes nothing', () => {
    const once = normalizeQuestionOptions(q());
    assert.deepEqual(normalizeQuestionOptions(once), once);
  });

  it('leaves already-clean options from the mock generator alone', () => {
    const clean = { options: ['صح', 'خطأ'], correctAnswer: 'خطأ' };
    assert.deepEqual(normalizeQuestionOptions(clean), clean);
  });
});
