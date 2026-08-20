/**
 * Class Mode deck builder tests.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/classDeck.test.ts
 *
 * Covers:
 *  1. A quiz becomes a projectable deck: intro first, summary last,
 *     consecutive slideNumbers (the presentation screen's progress dots
 *     assume this).
 *  2. Multiple-choice questions become whole-class 'question' slides whose
 *     correctIndex actually points at the correct option, and whose reveal
 *     agrees with the teacher panel's expectedAnswer.
 *  3. Open-ended questions do NOT get fabricated options.
 *  4. verified is only true when the caller vouches for the answer key —
 *     the ✓ badge must never appear on unverified content.
 *  5. Worksheets flatten across sections with continuous numbering.
 *  6. Objectives slide appears only when the curriculum book has النتاجات.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDeckFromQuiz, buildDeckFromWorksheet, buildGameDeckFromQuiz, objectivesSlide,
} from '../classDeck.ts';
import type { QuizOutput, WorksheetOutput } from '../ai/AIService.ts';
import type { KBLesson } from '../knowledgeBase.ts';

const QUIZ: QuizOutput = {
  title: 'اختبار قصير',
  duration: 10,
  totalPoints: 3,
  questions: [
    {
      id: 'q1',
      type: 'multiple_choice',
      text: 'ما ناتج 2 + 2؟',
      options: ['3', '4', '5'],
      correctAnswer: '4',
      points: 1,
      explanation: 'جمع بسيط',
    },
    {
      id: 'q2',
      type: 'short_answer',
      text: 'اشرح الفكرة بكلماتك.',
      correctAnswer: 'إجابة مفتوحة',
      points: 2,
      explanation: '',
    },
  ],
};

const WORKSHEET: WorksheetOutput = {
  title: 'ورقة عمل',
  instructions: 'أجب عن الأسئلة',
  sections: [
    {
      type: 'multiple_choice',
      title: 'القسم الأول',
      questions: [
        { text: 'س1', options: ['أ', 'ب'], answer: 'ب', points: 1 },
      ],
    },
    {
      type: 'short_answer',
      title: 'القسم الثاني',
      questions: [
        { text: 'س2', answer: 'إجابة', points: 1 },
        { text: 'س3', answer: 'إجابة أخرى', points: 1 },
      ],
    },
  ],
  answerKey: [],
};

function structural(slides: { slideNumber: number; type: string }[]) {
  assert.equal(slides[0]!.type, 'intro');
  assert.equal(slides[slides.length - 1]!.type, 'summary');
  slides.forEach((s, i) => assert.equal(s.slideNumber, i + 1, `slideNumber at ${i}`));
}

describe('buildDeckFromQuiz', () => {
  it('produces a structurally valid deck', () => {
    const deck = buildDeckFromQuiz(QUIZ, 'الاقترانات', true);
    structural(deck.slides);
    assert.equal(deck.groupType, 'whole-class');
    assert.equal(deck.answerKey.length, QUIZ.questions.length);
  });

  it('maps MCQs to question slides with a correct correctIndex', () => {
    const deck = buildDeckFromQuiz(QUIZ, 'الاقترانات', true);
    const q = deck.slides.find(s => s.type === 'question');
    assert.ok(q, 'has a question slide');
    assert.deepEqual(q!.options, ['3', '4', '5']);
    assert.equal(q!.options![q!.correctIndex!], '4');
    // Projected reveal must agree with the teacher panel.
    assert.equal(q!.options![q!.correctIndex!], q!.teacher?.expectedAnswer);
    assert.ok(q!.durationSeconds > 0, 'question slides run a think timer');
  });

  it('does not fabricate options for open-ended questions', () => {
    const deck = buildDeckFromQuiz(QUIZ, 'الاقترانات', true);
    const open = deck.slides.find(s => s.type === 'challenge');
    assert.ok(open, 'open question became a challenge slide');
    assert.equal(open!.options, undefined);
    assert.equal(open!.answer, 'إجابة مفتوحة');
  });

  it('marks verified only when the caller vouches for the key', () => {
    const unverified = buildDeckFromQuiz(QUIZ, 'الاقترانات', true);
    for (const s of unverified.slides) {
      assert.notEqual(s.verified, true, 'nothing verified by default');
    }
    const verified = buildDeckFromQuiz(QUIZ, 'الاقترانات', true, { verified: true });
    const q = verified.slides.find(s => s.type === 'question');
    assert.equal(q!.verified, true);
  });
});

describe('buildDeckFromWorksheet', () => {
  it('flattens sections with continuous question numbering', () => {
    const deck = buildDeckFromWorksheet(WORKSHEET, 'الاقترانات', true);
    structural(deck.slides);
    const qSlides = deck.slides.filter(s => s.type === 'question' || s.type === 'challenge');
    assert.equal(qSlides.length, 3, 'all three questions across both sections');
    assert.equal(qSlides[0]!.title, 'سؤال 1');
    assert.equal(qSlides[2]!.title, 'سؤال 3');
    assert.equal(deck.answerKey.length, 3);
  });

  it('maps worksheet MCQ answers to the right option', () => {
    const deck = buildDeckFromWorksheet(WORKSHEET, 'الاقترانات', true);
    const q = deck.slides.find(s => s.type === 'question');
    assert.equal(q!.options![q!.correctIndex!], 'ب');
  });
});

describe('objectivesSlide', () => {
  const lessonWith = { objectives: ['نتاج أول', 'نتاج ثانٍ'] } as KBLesson;
  const lessonWithout = { objectives: [] } as unknown as KBLesson;

  it('renders the book objectives when present', () => {
    const s = objectivesSlide(lessonWith, 'الاقترانات', true);
    assert.ok(s);
    assert.ok(s!.content.includes('نتاج أول'));
    assert.ok(s!.content.includes('نتاج ثانٍ'));
  });

  it('returns null when the book has no objectives (no empty slide)', () => {
    assert.equal(objectivesSlide(lessonWithout, 'الاقترانات', true), null);
    assert.equal(objectivesSlide(null, 'الاقترانات', true), null);
  });
});

describe('buildGameDeckFromQuiz', () => {
  const MCQ_ONLY: QuizOutput = {
    ...QUIZ,
    questions: Array.from({ length: 7 }, (_, i) => ({
      id: `q${i}`,
      type: 'multiple_choice' as const,
      text: `سؤال ${i}`,
      options: ['أ', 'ب', 'ج'],
      correctAnswer: 'ب',
      points: 1,
      explanation: '',
    })),
  };

  it('carries a game config that switches the presentation into game mode', () => {
    const deck = buildGameDeckFromQuiz(MCQ_ONLY, 'الاقترانات', true, { teamCount: 4 });
    assert.equal(deck.activityType, 'class-game');
    assert.equal(deck.game?.teamCount, 4);
    assert.equal(deck.game?.questionCount, 7);
  });

  it('drops open-ended questions — they cannot be adjudicated on a projector', () => {
    // QUIZ has one MCQ and one short-answer question.
    const deck = buildGameDeckFromQuiz(QUIZ, 'الاقترانات', true, { teamCount: 2 });
    assert.equal(deck.game?.questionCount, 1);
    assert.equal(deck.slides.filter(s => s.type === 'question').length, 1);
  });

  it('numbers questionIndex against the ledger, not the slide position', () => {
    const deck = buildGameDeckFromQuiz(MCQ_ONLY, 'الاقترانات', true, { teamCount: 3 });
    const questions = deck.slides.filter(s => s.type === 'question');
    // Scoreboard slides sit between questions, so the two must diverge — if
    // they did not, this test would not be protecting anything.
    assert.deepEqual(questions.map(q => q.questionIndex), [0, 1, 2, 3, 4, 5, 6]);
    assert.notDeepEqual(questions.map(q => q.slideNumber), questions.map(q => q.questionIndex));
  });

  it('interleaves scoreboards and ends on the podium', () => {
    const deck = buildGameDeckFromQuiz(MCQ_ONLY, 'الاقترانات', true, { teamCount: 3 });
    assert.equal(deck.slides[0].type, 'intro');
    assert.equal(deck.slides[deck.slides.length - 1].type, 'podium');
    assert.ok(deck.slides.some(s => s.type === 'scoreboard'));
    // Never a scoreboard immediately before the podium — it would show the
    // same standings twice in a row.
    assert.notEqual(deck.slides[deck.slides.length - 2].type, 'scoreboard');
    deck.slides.forEach((s, i) => assert.equal(s.slideNumber, i + 1, `slideNumber at ${i}`));
  });

  it('clamps the team count to what the game engine supports', () => {
    assert.equal(buildGameDeckFromQuiz(MCQ_ONLY, 'x', true, { teamCount: 0 }).game?.teamCount, 2);
    assert.equal(buildGameDeckFromQuiz(MCQ_ONLY, 'x', true, { teamCount: 99 }).game?.teamCount, 6);
  });

  it('maps each question to the correct option', () => {
    const deck = buildGameDeckFromQuiz(MCQ_ONLY, 'الاقترانات', true, { teamCount: 2 });
    for (const q of deck.slides.filter(s => s.type === 'question')) {
      assert.equal(q.options![q.correctIndex!], 'ب');
    }
  });

  it('reports zero scoreable questions rather than building an unplayable game', () => {
    const openOnly: QuizOutput = { ...QUIZ, questions: [QUIZ.questions[1]] };
    const deck = buildGameDeckFromQuiz(openOnly, 'الاقترانات', true, { teamCount: 3 });
    assert.equal(deck.game?.questionCount, 0);
  });
});
