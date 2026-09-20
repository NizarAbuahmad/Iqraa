/**
 * Worksheet editing transforms.
 *
 * The case that matters is the same one `quizEdits.test.ts` guards, made
 * harder by the shape: the answer lives in a separate flat `answerKey`, keyed
 * by 1-based position across `sections[].questions[]`. An edit that forgets
 * this produces a question that renders perfectly and answers the wrong
 * question number, or a delete that leaves a gap in the numbering.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { WorksheetOutput } from '../ai/AIService.ts';
import {
  answerFor,
  applyWorksheetAnswerEdit,
  applyWorksheetOptionEdit,
  applyWorksheetQuestionEdit,
  flatIndexOf,
  removeWorksheetQuestionAt,
} from '../worksheetEdits.ts';

function sheet(): WorksheetOutput {
  return {
    title: 'ورقة عمل: تجربة',
    instructions: 'أجب عن الأسئلة التالية.',
    sections: [
      {
        type: 'multiple_choice',
        title: 'أ) تمارين تمهيدية',
        questions: [
          { text: 'أوجد ناتج ٢ + ٣', options: ['٤', '٥', '٦'], points: 2 },
          { text: 'أوجد ناتج ٤ × ٢', options: ['٦', '٨', '١٠'], points: 2 },
        ],
      },
      {
        type: 'short_answer',
        title: 'ب) تمارين صفية',
        questions: [
          { text: 'اشرح مفهوم الجمع', points: 4 },
        ],
      },
    ],
    answerKey: [
      { num: 1, answer: '٥' },
      { num: 2, answer: '٨' },
      { num: 3, answer: 'تعريف صحيح + مثال' },
    ],
  };
}

describe('flatIndexOf / answerFor', () => {
  it('maps each question to its own flat position and answer', () => {
    assert.equal(flatIndexOf(sheet(), 0, 0), 0);
    assert.equal(flatIndexOf(sheet(), 0, 1), 1);
    assert.equal(flatIndexOf(sheet(), 1, 0), 2);
    assert.equal(answerFor(sheet(), 0, 0), '٥');
    assert.equal(answerFor(sheet(), 1, 0), 'تعريف صحيح + مثال');
  });
});

describe('applyWorksheetQuestionEdit', () => {
  it('patches the question without touching the answer key', () => {
    const out = applyWorksheetQuestionEdit(sheet(), 0, 1, { text: 'أوجد ناتج ٤ × ٣', points: 3 });
    assert.equal(out.sections[0]!.questions[1]!.text, 'أوجد ناتج ٤ × ٣');
    assert.equal(out.sections[0]!.questions[1]!.points, 3);
    assert.equal(out.answerKey[1]!.answer, '٨', 'the answer for this question must not move');
  });

  it('does not mutate the worksheet it was given', () => {
    const original = sheet();
    applyWorksheetQuestionEdit(original, 0, 0, { points: 99 });
    assert.equal(original.sections[0]!.questions[0]!.points, 2);
  });
});

describe('applyWorksheetOptionEdit', () => {
  it('carries the answer key when the correct option is rewritten', () => {
    const out = applyWorksheetOptionEdit(sheet(), 0, 0, 1, 'خمسة');
    assert.deepEqual(out.sections[0]!.questions[0]!.options, ['٤', 'خمسة', '٦']);
    assert.equal(out.answerKey[0]!.answer, 'خمسة', 'key must follow the option it points at');
  });

  it('leaves the key alone when a different option is rewritten', () => {
    const out = applyWorksheetOptionEdit(sheet(), 0, 0, 0, 'أربعة');
    assert.deepEqual(out.sections[0]!.questions[0]!.options, ['أربعة', '٥', '٦']);
    assert.equal(out.answerKey[0]!.answer, '٥');
  });

  it('never leaves the key pointing at an option that is gone', () => {
    for (let i = 0; i < 3; i += 1) {
      const out = applyWorksheetOptionEdit(sheet(), 0, 0, i, `بديل ${i}`);
      assert.ok(
        (out.sections[0]!.questions[0]!.options ?? []).includes(out.answerKey[0]!.answer),
        `editing option ${i} orphaned the answer key`,
      );
    }
  });
});

describe('applyWorksheetAnswerEdit', () => {
  it('rewrites the free-text answer for a short-answer question', () => {
    const out = applyWorksheetAnswerEdit(sheet(), 1, 0, 'تعريف أدق + مثال جديد');
    assert.equal(out.answerKey[2]!.answer, 'تعريف أدق + مثال جديد');
    assert.equal(out.sections[1]!.questions[0]!.text, 'اشرح مفهوم الجمع', 'the question itself is untouched');
  });

  it('lets a tap mark a different option correct', () => {
    // The UI passes the tapped option's own text — the same effect as
    // retyping the key, without risking a typo mismatch.
    const out = applyWorksheetAnswerEdit(sheet(), 0, 0, '٤');
    assert.equal(out.answerKey[0]!.answer, '٤');
    assert.deepEqual(out.sections[0]!.questions[0]!.options, ['٤', '٥', '٦'], 'options are untouched');
  });
});

describe('removeWorksheetQuestionAt', () => {
  it('renumbers the answer key so nothing points at a gap', () => {
    const out = removeWorksheetQuestionAt(sheet(), 0, 0);
    assert.equal(out.sections[0]!.questions.length, 1);
    assert.equal(out.sections[0]!.questions[0]!.text, 'أوجد ناتج ٤ × ٢');
    assert.equal(out.answerKey.length, 2);
    assert.equal(out.answerKey[0]!.num, 1);
    assert.equal(out.answerKey[0]!.answer, '٨', 'the surviving question keeps its own answer');
    assert.equal(out.answerKey[1]!.answer, 'تعريف صحيح + مثال');
  });

  it('drops a section left with no questions', () => {
    const out = removeWorksheetQuestionAt(sheet(), 1, 0);
    assert.equal(out.sections.length, 1, 'the now-empty second section is gone');
    assert.equal(out.answerKey.length, 2);
  });

  it('does not mutate the worksheet it was given', () => {
    const original = sheet();
    removeWorksheetQuestionAt(original, 0, 0);
    assert.equal(original.sections[0]!.questions.length, 2);
    assert.equal(original.answerKey.length, 3);
  });
});
