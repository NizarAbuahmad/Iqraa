/**
 * Quiz editing transforms.
 *
 * The case that matters is the answer key. `correctAnswer` holds option text
 * rather than an index, so an edit that does not carry it produces a question
 * which renders perfectly and has no correct option — discovered only while
 * marking, by which point the paper has been sat.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { QuizOutput, QuizQuestion } from '../ai/AIService.ts';
import {
  applyOptionEdit,
  applyQuestionEdit,
  optionMarkerState,
  parsePoints,
  removeQuestionAt,
  totalPointsOf,
} from '../quizEdits.ts';

const mcq = (): QuizQuestion => ({
  id: 'q1',
  type: 'multiple_choice',
  text: 'ما ناتج ٢ + ٣؟',
  options: ['٤', '٥', '٦'],
  correctAnswer: '٥',
  points: 2,
  explanation: 'جمع بسيط',
});

const quiz = (): QuizOutput => ({
  title: 'تقييم سريع',
  duration: 20,
  totalPoints: 5,
  questions: [mcq(), { ...mcq(), id: 'q2', points: 3, correctAnswer: '٦' }],
});

describe('applyOptionEdit', () => {
  it('carries the answer key when the correct option is rewritten', () => {
    const out = applyOptionEdit(mcq(), 1, 'خمسة');
    assert.deepEqual(out.options, ['٤', 'خمسة', '٦']);
    assert.equal(out.correctAnswer, 'خمسة', 'key must follow the option it points at');
  });

  it('leaves the key alone when a different option is rewritten', () => {
    const out = applyOptionEdit(mcq(), 0, 'أربعة');
    assert.deepEqual(out.options, ['أربعة', '٥', '٦']);
    assert.equal(out.correctAnswer, '٥');
  });

  it('never leaves the key pointing at an option that is gone', () => {
    // The whole point: after any single-option edit the key must still match
    // one of the options on offer.
    for (let i = 0; i < 3; i += 1) {
      const out = applyOptionEdit(mcq(), i, `بديل ${i}`);
      assert.ok(
        (out.options ?? []).includes(out.correctAnswer),
        `editing option ${i} orphaned the answer key`,
      );
    }
  });

  it('handles a question with no options without throwing', () => {
    const short: QuizQuestion = {
      id: 'q9', type: 'short_answer', text: 'اشرح', correctAnswer: 'إجابة', points: 1, explanation: '',
    };
    const out = applyOptionEdit(short, 0, 'x');
    assert.deepEqual(out.options, []);
    assert.equal(out.correctAnswer, 'إجابة');
  });
});

describe('totals stay in step with the questions', () => {
  it('recomputes the total when marks change', () => {
    const out = applyQuestionEdit(quiz(), 0, { points: 10 });
    assert.equal(out.totalPoints, 13);
  });

  it('recomputes the total when a question is removed', () => {
    const out = removeQuestionAt(quiz(), 0);
    assert.equal(out.questions.length, 1);
    assert.equal(out.totalPoints, 3);
  });

  it('sums an empty paper to zero rather than NaN', () => {
    assert.equal(totalPointsOf([]), 0);
  });

  it('does not mutate the quiz it was given', () => {
    const original = quiz();
    applyQuestionEdit(original, 0, { points: 99 });
    assert.equal(original.questions[0]!.points, 2);
    assert.equal(original.totalPoints, 5);
  });
});

describe('parsePoints', () => {
  it('accepts a positive whole number', () => {
    assert.equal(parsePoints('4'), 4);
    assert.equal(parsePoints(' 12 '), 12);
  });

  it('reads Arabic-Indic digits the teacher may type', () => {
    // The keyboard is Arabic; ٥ is what gets typed for five. Rejecting it would
    // read as the field refusing to accept a number at all.
    assert.equal(parsePoints('٥'), 5);
    assert.equal(parsePoints('١٢'), 12);
    assert.equal(parsePoints('٠'), null);
  });

  it('rejects zero, blank and non-numeric input', () => {
    // A zero-mark question takes a student's time and counts for nothing.
    assert.equal(parsePoints('0'), null);
    assert.equal(parsePoints(''), null);
    assert.equal(parsePoints('abc'), null);
  });
});

describe('optionMarkerState', () => {
  it('hides every marker while the answer key is hidden', () => {
    // The bug this covers: the row tint went away on "hide answers" but the
    // picker still drew a green tick against the right option, so the answer
    // was still on screen — and still announced — with the class watching.
    assert.equal(optionMarkerState(false, 'x = 3', 'x = 3'), 'hidden');
    assert.equal(optionMarkerState(false, 'x = 4', 'x = 3'), 'hidden');
  });

  it('marks the key once answers are shown', () => {
    assert.equal(optionMarkerState(true, 'x = 3', 'x = 3'), 'selected');
    assert.equal(optionMarkerState(true, 'x = 4', 'x = 3'), 'unselected');
  });
});
