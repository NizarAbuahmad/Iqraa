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
  assembleDeckSlides,
  buildDeckFromQuiz,
  buildDeckFromWorksheet,
  buildGameDeckFromQuiz,
  objectivesSlide,
} from '../classDeck.ts';
import type { ActivitySlide, QuizOutput, WorksheetOutput } from '../ai/AIService.ts';
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

// The generator never actually fills in a question's own `answer` field —
// only the top-level `answerKey`, keyed by 1-based position across the
// flattened section/question list. Match that shape exactly: a fixture with
// answers on both would hide the real bug of the wrong one being read.
const WORKSHEET: WorksheetOutput = {
  title: 'ورقة عمل',
  instructions: 'أجب عن الأسئلة',
  sections: [
    {
      type: 'multiple_choice',
      title: 'القسم الأول',
      questions: [
        { text: 'س1', options: ['أ', 'ب'], points: 1 },
      ],
    },
    {
      type: 'short_answer',
      title: 'القسم الثاني',
      questions: [
        { text: 'س2', points: 1 },
        { text: 'س3', points: 1 },
      ],
    },
  ],
  answerKey: [
    { num: 1, answer: 'ب' },
    { num: 2, answer: 'إجابة' },
    { num: 3, answer: 'إجابة أخرى' },
  ],
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

  it('reads the answer from answerKey, not a per-question field', () => {
    // Regression: this used to read q.answer, which the generator never
    // populates — every worksheet's Class Mode answers/correctIndex were
    // silently wrong (defaulting to option 0) until this was fixed.
    const deck = buildDeckFromWorksheet(WORKSHEET, 'الاقترانات', true);
    const open = deck.slides.find(s => s.type === 'challenge');
    assert.equal(open!.answer, 'إجابة');
    assert.equal(deck.answerKey[1], 'سؤال 2: إجابة');
  });
});

describe('buildDeckFromWorksheet — per-question provenance', () => {
  // WORKSHEET's first question (q1, "س1") is the only MCQ, so it's the only
  // 'question' slide — same alignment rule as buildDeckFromQuiz: outcomes[]
  // is indexed by flattened question position, not by slide.
  it('badges a question from its own outcome', () => {
    const deck = buildDeckFromWorksheet(WORKSHEET, 'الاقترانات', true, {
      outcomes: [{ verifiedBy: 'symbolic', computedAnswer: '2x' }, undefined, undefined],
    });
    const q = deck.slides.find(s => s.type === 'question');
    assert.equal(q?.verified, true);
    assert.equal(q?.verifiedBy, 'symbolic');
    assert.equal(q?.computedAnswer, '2x');
  });

  it('shows no badge for a question with no outcome', () => {
    const deck = buildDeckFromWorksheet(WORKSHEET, 'الاقترانات', true, { outcomes: [] });
    const q = deck.slides.find(s => s.type === 'question');
    assert.equal(q?.verified, false);
    assert.equal(q?.verifiedBy, undefined);
  });

  it('still honours the whole-deck flag when no outcomes are given', () => {
    const deck = buildDeckFromWorksheet(WORKSHEET, 'الاقترانات', true, { verified: true });
    assert.ok(deck.slides.filter(s => s.type === 'question').every(s => s.verified === true));
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

describe('buildDeckFromQuiz — per-question provenance', () => {
  // QUIZ is q1 multiple_choice + q2 short_answer. Only the MCQ becomes a
  // 'question' slide; open-ended items are 'challenge' and carry no badge.
  // outcomes[] is indexed by question, not by slide.
  it('badges a question from its own outcome', () => {
    const deck = buildDeckFromQuiz(QUIZ, 'الاشتقاق', true, {
      outcomes: [{ verifiedBy: 'symbolic', computedAnswer: '12x^3' }, undefined],
    });
    const q = deck.slides.find(s => s.type === 'question');
    assert.equal(q?.verified, true);
    assert.equal(q?.verifiedBy, 'symbolic');
    assert.equal(q?.computedAnswer, '12x^3');
  });

  it('badges a bank answer as bank, without a computed answer', () => {
    // 'bank' is still a badge — it claims provenance, not proof — but it must
    // never carry a computed answer, which only the verifier can produce.
    const deck = buildDeckFromQuiz(QUIZ, 'الاشتقاق', true, {
      outcomes: [{ verifiedBy: 'bank' }, undefined],
    });
    const q = deck.slides.find(s => s.type === 'question');
    assert.equal(q?.verifiedBy, 'bank');
    assert.equal(q?.computedAnswer, undefined);
  });

  it('shows no badge for a question with no outcome', () => {
    // Absent evidence is not pending evidence. The projector badge is the last
    // thing between a teacher and telling a room a wrong answer was checked.
    const deck = buildDeckFromQuiz(QUIZ, 'الاشتقاق', true, { outcomes: [] });
    const q = deck.slides.find(s => s.type === 'question');
    assert.equal(q?.verified, false);
    assert.equal(q?.verifiedBy, undefined);
  });

  it('still honours the whole-deck flag when no outcomes are given', () => {
    const deck = buildDeckFromQuiz(QUIZ, 'الاشتقاق', true, { verified: true });
    assert.ok(deck.slides.filter(s => s.type === 'question').every(s => s.verified === true));
  });
});

// ── assembleDeckSlides ────────────────────────────────────────────────────
// The ordering rule for Start Class. It used to live inline in the home
// screen, untested, and had to survive that screen being retired.

const slide = (type: ActivitySlide['type'], title: string): ActivitySlide =>
  ({ slideNumber: 0, type, title, content: title, durationSeconds: 0 }) as ActivitySlide;

describe('assembleDeckSlides', () => {
  it('numbers slides consecutively from 1', () => {
    // The presentation screen's progress dots assume this.
    const deck = assembleDeckSlides({
      activitySlides: [slide('intro', 'i'), slide('question', 'q1'), slide('question', 'q2')],
    });
    assert.deepEqual(deck.map(s => s.slideNumber), [1, 2, 3]);
  });

  it('puts objectives and the graph before the questions', () => {
    // The class should see what it is meant to learn before being asked.
    const deck = assembleDeckSlides({
      activitySlides: [slide('intro', 'i'), slide('question', 'q1')],
      objectives: slide('graph', 'obj'),
      graph: slide('graph', 'graph'),
    });
    assert.deepEqual(deck.map(s => s.title), ['i', 'obj', 'graph', 'q1']);
  });

  it('puts book figures after the objectives and before the graph', () => {
    // "Here is the lesson, here is how your book draws it, now watch it move"
    // — the same order buildLessonDeck uses. And the teacher's own pinned
    // media stays after the questions: the two media slots are not one.
    const deck = assembleDeckSlides({
      activitySlides: [slide('intro', 'i'), slide('question', 'q1')],
      objectives: slide('intro', 'obj'),
      figures: [slide('media', 'fig1'), slide('media', 'fig2')],
      graph: slide('graph', 'graph'),
      media: [slide('media', 'pinned')],
    });
    assert.deepEqual(
      deck.map(s => s.title),
      ['i', 'obj', 'fig1', 'fig2', 'graph', 'q1', 'pinned'],
    );
  });

  it('keeps a trailing summary last when media is appended', () => {
    // Media appended naively lands after "Well done!", which ends the lesson
    // twice. The summary is moved, not duplicated.
    const deck = assembleDeckSlides({
      activitySlides: [slide('intro', 'i'), slide('question', 'q1'), slide('summary', 'bye')],
      media: [slide('media', 'video')],
    });
    assert.deepEqual(deck.map(s => s.title), ['i', 'q1', 'video', 'bye']);
  });

  it('leaves a mid-deck summary where it is', () => {
    // Only a trailing summary is a sign-off; one in the middle is a section
    // break the generator meant to put there.
    const deck = assembleDeckSlides({
      activitySlides: [slide('intro', 'i'), slide('summary', 'part1'), slide('question', 'q1')],
    });
    assert.deepEqual(deck.map(s => s.title), ['i', 'part1', 'q1']);
  });

  it('omits every optional part without leaving a hole', () => {
    // A lesson with no objectives, nothing plottable and no media is normal,
    // not an error — chemistry has all three.
    const deck = assembleDeckSlides({
      activitySlides: [slide('intro', 'i'), slide('question', 'q1')],
      objectives: null,
      graph: null,
      media: [],
    });
    assert.deepEqual(deck.map(s => s.title), ['i', 'q1']);
  });

  it('returns an empty deck rather than throwing when there is no intro', () => {
    assert.deepEqual(assembleDeckSlides({ activitySlides: [] }), []);
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

  it('shares the same "question appears, everyone thinks silently" rules as the plain review deck', () => {
    // buildDeckFromQuiz's intro and this one used to hand-write these two
    // lines separately — dedupe them into one place and this must still hold.
    const reviewIntro = buildDeckFromQuiz(MCQ_ONLY, 'الاقترانات', true).slides[0]!.content;
    const gameIntro = buildGameDeckFromQuiz(MCQ_ONLY, 'الاقترانات', true, { teamCount: 3 }).slides[0]!.content;
    assert.match(reviewIntro, /يظهر السؤال ويبدأ المؤقت/);
    assert.match(reviewIntro, /الجميع يفكر بصمت/);
    assert.match(gameIntro, /يظهر السؤال ويبدأ المؤقت/);
    assert.match(gameIntro, /الجميع يفكر بصمت/);
  });

  it('interpolates the clamped team count into the intro, not the raw input', () => {
    const deck = buildGameDeckFromQuiz(MCQ_ONLY, 'الاقترانات', true, { teamCount: 99 });
    assert.equal(deck.game?.teamCount, 6);
    assert.match(deck.slides[0]!.content, /مقسوم إلى 6 فرق/);
    assert.doesNotMatch(deck.slides[0]!.content, /مقسوم إلى 99 فرق/);
  });
});

/**
 * Book figures on the question decks.
 *
 * These builders had no figure slot at all: a worksheet or quiz projected
 * through Class Mode showed none of the book's diagrams, while the *same*
 * worksheet printed from the same screen carried them in its appendix. Chat
 * decks were the third caller and got nothing either.
 *
 * `figureUri` is injected for the reason `bookFigureSlides` documents — the
 * real resolver reaches into `react-native`, which this suite cannot load.
 * That makes it also the switch under test: absent means no figures, which is
 * what every caller got before and what a caller that forgets still gets.
 */
describe('book figures on quiz and worksheet decks', () => {
  // A lesson that genuinely has crops in the checked-in index.
  const WITH_FIGURES = { id: 'kbl-math-s1-nccd-u1_l1', objectives: [] } as unknown as KBLesson;
  const uri = (f: { file: string }) => `asset://${f.file}`;
  const figs = (d: { slides: ActivitySlide[] }) =>
    d.slides.filter(s => s.type === 'media' && s.mediaUrl?.startsWith('asset://'));

  it('shows none unless a resolver is passed — the old behaviour, unchanged', () => {
    assert.equal(figs(buildDeckFromQuiz(QUIZ, 'الدوائر', true, { lesson: WITH_FIGURES })).length, 0);
    assert.equal(
      figs(buildDeckFromWorksheet(WORKSHEET, 'الدوائر', true, { lesson: WITH_FIGURES })).length,
      0,
    );
  });

  it("shows the lesson's figures on every deck kind once one is", () => {
    for (const deck of [
      buildDeckFromQuiz(QUIZ, 'الدوائر', true, { lesson: WITH_FIGURES, figureUri: uri }),
      buildDeckFromWorksheet(WORKSHEET, 'الدوائر', true, { lesson: WITH_FIGURES, figureUri: uri }),
      buildGameDeckFromQuiz(QUIZ, 'الدوائر', true, {
        teamCount: 3, lesson: WITH_FIGURES, figureUri: uri,
      }),
    ]) {
      const shown = figs(deck);
      assert.ok(shown.length > 0, 'figures reached the deck');
      // The page citation is the whole point: it is what lets a teacher hold
      // the projected figure against the printed book.
      for (const s of shown) assert.match(s.mediaCaption ?? '', /صفحة/);
    }
  });

  it('places them before the first question, not after the answers', () => {
    const deck = buildDeckFromQuiz(QUIZ, 'الدوائر', true, { lesson: WITH_FIGURES, figureUri: uri });
    const firstFigure = deck.slides.findIndex(s => s.mediaUrl?.startsWith('asset://'));
    const firstQuestion = deck.slides.findIndex(s => s.type === 'question' || s.type === 'challenge');
    assert.ok(firstFigure > 0 && firstQuestion > 0);
    assert.ok(firstFigure < firstQuestion, "the class sees the book's diagram before being asked");
  });

  it('keeps slideNumbers consecutive — the progress dots depend on it', () => {
    const deck = buildDeckFromWorksheet(WORKSHEET, 'الدوائر', true, {
      lesson: WITH_FIGURES, figureUri: uri,
    });
    assert.deepEqual(
      deck.slides.map(s => s.slideNumber),
      deck.slides.map((_, i) => i + 1),
    );
  });

  it('drops a figure the bundler never shipped rather than rendering it broken', () => {
    const deck = buildDeckFromQuiz(QUIZ, 'الدوائر', true, {
      lesson: WITH_FIGURES, figureUri: () => null,
    });
    assert.equal(deck.slides.filter(s => s.type === 'media').length, 0);
  });
});
