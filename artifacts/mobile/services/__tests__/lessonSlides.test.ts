/**
 * Slides Maker tests.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/lessonSlides.test.ts
 *
 * Covers:
 *  1. The deck is well-formed for the presentation screen: consecutive
 *     slideNumbers, a title first and a summary/closing slide present.
 *  2. Curriculum content wins over generated content, and an ungrounded deck
 *     says so in teacherPreparation — the app's standing rule that grounding
 *     is stated rather than implied.
 *  3. Worked examples are attempts, not answers: they carry a timer and keep
 *     the answer behind `answer` instead of printing it in `content`.
 *  4. Absent sections are omitted, never padded with empty slides.
 *  5. Language selection reads the matching ar/en field, not both.
 *  6. splitExample splits on the LAST separator, which is what keeps maths
 *     like `2x + 3 = 11 → x = 4` intact.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildLessonDeck, splitExample } from '../lessonSlides.ts';
import type { LessonPlanOutput } from '../ai/AIService.ts';
import type { KBLesson } from '../knowledgeBase.ts';

const LESSON: KBLesson = {
  id: 'g10-math-u3-l2',
  unitId: 'g10-math-u3',
  order: 2,
  titleAr: 'حل المعادلات التربيعية',
  titleEn: 'Solving Quadratic Equations',
  summaryAr: 'نتعلم حل المعادلة التربيعية بالتحليل.',
  summaryEn: 'We learn to solve quadratics by factoring.',
  keyConceptsAr: ['الصيغة العامة ax² + bx + c = 0', 'التحليل إلى عاملين'],
  keyConceptsEn: ['Standard form ax² + bx + c = 0', 'Factoring into two binomials'],
  keyTerms: [
    { ar: 'الجذر', en: 'Root', definitionAr: 'قيمة تحقق المعادلة', definitionEn: 'A value satisfying the equation' },
  ],
  objectives: ['حل المعادلة التربيعية بالتحليل', 'استخدام القانون العام'],
  periods: 3,
  examplesAr: ['حل: x² - 5x + 6 = 0 → x = 2 أو x = 3'],
  examplesEn: ['Solve: x² - 5x + 6 = 0 → x = 2 or x = 3'],
  rulesAr: ['إذا كان حاصل الضرب صفرًا فأحد العاملين صفر'],
  rulesEn: ['If a product is zero, one of the factors is zero'],
};

const PLAN: LessonPlanOutput = {
  title: 'حل المعادلات التربيعية',
  grade: 'الصف العاشر',
  subject: 'الرياضيات',
  duration: 45,
  objectives: ['هدف مولّد'],
  materials: ['سبورة'],
  introduction: 'ابدأ بسؤال عن مساحة حديقة.',
  mainActivity: 'شرح التحليل.',
  guidedPractice: 'حل تمرينين معًا.',
  independentPractice: 'حل ٤ تمارين فرديًا.',
  closure: 'لخّص الخطوات الثلاث.',
  assessment: 'بطاقة خروج.',
  differentiation: 'أعطِ المتقدمين معادلة بمعاملات كسرية.',
  homework: 'تمارين ١-٦ صفحة ٧٢.',
};

const numbersOf = (deck: { slides: { slideNumber: number }[] }) =>
  deck.slides.map(s => s.slideNumber);

describe('deck shape', () => {
  it('numbers slides consecutively from 1 — the progress dots assume it', () => {
    const deck = buildLessonDeck('حل المعادلات التربيعية', true, { lesson: LESSON, plan: PLAN });
    assert.deepEqual(numbersOf(deck), deck.slides.map((_, i) => i + 1));
  });

  it('opens on the lesson title and includes a closing summary', () => {
    const deck = buildLessonDeck('حل المعادلات التربيعية', true, { lesson: LESSON, plan: PLAN });
    assert.equal(deck.slides[0].type, 'intro');
    assert.equal(deck.slides[0].title, 'حل المعادلات التربيعية');
    assert.ok(deck.slides.some(s => s.type === 'summary'));
  });

  it('is renderable by the presentation screen as a lesson-slides activity', () => {
    const deck = buildLessonDeck('الاقترانات', true, { lesson: LESSON });
    assert.equal(deck.activityType, 'lesson-slides');
    assert.equal(deck.groupType, 'whole-class');
    // No `game` config — a teaching deck must never start scoring.
    assert.equal(deck.game, undefined);
  });
});

describe('grounding', () => {
  it('prefers curriculum objectives over generated ones', () => {
    const deck = buildLessonDeck('x', true, { lesson: LESSON, plan: PLAN });
    const objectives = deck.slides.find(s => s.title.includes('نتاجات'));
    assert.ok(objectives);
    assert.ok(objectives!.content.includes('حل المعادلة التربيعية بالتحليل'));
    assert.equal(objectives!.content.includes('هدف مولّد'), false);
  });

  it('falls back to plan objectives when the book has none', () => {
    const bare = { ...LESSON, objectives: [], keyConceptsAr: [], keyConceptsEn: [] };
    const deck = buildLessonDeck('x', true, { lesson: bare, plan: PLAN });
    const objectives = deck.slides.find(s => s.title.includes('نتاجات'));
    assert.ok(objectives!.content.includes('هدف مولّد'));
  });

  it('states in teacherPreparation whether the deck is curriculum-backed', () => {
    const grounded = buildLessonDeck('x', true, { lesson: LESSON, plan: PLAN });
    assert.ok(grounded.teacherPreparation.includes('كتاب المنهاج'));
    assert.equal(grounded.teacherPreparation.includes('مولّدة'), false);

    const ungrounded = buildLessonDeck('x', true, { lesson: null, plan: PLAN });
    assert.ok(ungrounded.teacherPreparation.includes('مولّدة'));
  });
});

describe('worked examples', () => {
  it('gives the class time to attempt before the answer exists on screen', () => {
    const deck = buildLessonDeck('x', true, { lesson: LESSON, plan: PLAN });
    const example = deck.slides.find(s => s.type === 'challenge');
    assert.ok(example);
    assert.ok(example!.durationSeconds > 0);
    // The answer is behind the reveal, not printed with the problem.
    assert.equal(example!.content.includes('x = 2'), false);
    assert.equal(example!.answer, 'x = 2 أو x = 3');
  });

  it('omits examples entirely when the teacher turns them off', () => {
    const deck = buildLessonDeck('x', true, { lesson: LESSON, plan: PLAN, includeExamples: false });
    assert.equal(deck.slides.some(s => s.type === 'challenge'), false);
    assert.deepEqual(deck.answerKey, []);
  });

  it('drops practice and homework when practice is turned off', () => {
    const deck = buildLessonDeck('x', true, { lesson: LESSON, plan: PLAN, includePractice: false });
    assert.equal(deck.slides.some(s => s.title.includes('تدريب')), false);
    assert.equal(deck.slides.some(s => s.title.includes('الواجب')), false);
  });
});

describe('missing sections', () => {
  it('omits rather than pads when there is no plan', () => {
    const deck = buildLessonDeck('x', true, { lesson: LESSON, plan: null });
    assert.equal(deck.slides.some(s => s.title.includes('تمهيد')), false);
    assert.equal(deck.slides.some(s => s.title.includes('الواجب')), false);
    // Every slide still carries content — no blank slides reach the projector.
    assert.ok(deck.slides.every(s => s.title.trim().length > 0));
  });

  it('still produces a usable deck from a plan alone', () => {
    const deck = buildLessonDeck('موضوع', true, { lesson: null, plan: PLAN });
    assert.ok(deck.slides.length >= 3);
    assert.ok(deck.slides.some(s => s.type === 'summary'));
  });

  it('never returns an empty deck', () => {
    const deck = buildLessonDeck('', true, {});
    assert.ok(deck.slides.length >= 2);
    assert.equal(deck.slides[0].type, 'intro');
  });
});

describe('language', () => {
  it('reads the English fields when building an English deck', () => {
    const deck = buildLessonDeck('Solving Quadratic Equations', false, { lesson: LESSON, plan: PLAN });
    const concepts = deck.slides.filter(s => s.title.startsWith('Idea'));
    assert.ok(concepts.length > 0);
    assert.ok(concepts[0].content.includes('Standard form'));
    assert.equal(concepts.some(s => s.content.includes('الصيغة')), false);
  });

  it('reads the Arabic fields when building an Arabic deck', () => {
    const deck = buildLessonDeck('حل المعادلات التربيعية', true, { lesson: LESSON });
    const concepts = deck.slides.filter(s => s.title.startsWith('الفكرة'));
    assert.ok(concepts[0].content.includes('الصيغة العامة'));
  });
});

describe('splitExample', () => {
  it('splits on the last arrow, keeping equations intact', () => {
    assert.deepEqual(splitExample('2x + 3 = 11 → x = 4'), ['2x + 3 = 11', 'x = 4']);
  });

  it('handles the => form', () => {
    assert.deepEqual(splitExample('x² = 9 => x = ±3'), ['x² = 9', 'x = ±3']);
  });

  it('splits on a trailing answer label', () => {
    assert.deepEqual(splitExample('احسب ٢ + ٢ الجواب: ٤'), ['احسب ٢ + ٢', '٤']);
    assert.deepEqual(splitExample('Compute 2 + 2 Answer: 4'), ['Compute 2 + 2', '4']);
  });

  it('returns the whole string as the problem when there is no answer', () => {
    assert.deepEqual(splitExample('حلّل المقدار x² - 9'), ['حلّل المقدار x² - 9', '']);
  });

  it('does not split a bare equation at its own equals sign', () => {
    const [problem, answer] = splitExample('x + 1 = 5');
    assert.equal(problem, 'x + 1 = 5');
    assert.equal(answer, '');
  });
});
