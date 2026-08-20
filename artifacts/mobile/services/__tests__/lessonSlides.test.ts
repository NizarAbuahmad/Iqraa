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

import { buildLessonDeck, splitChecks, splitExample } from '../lessonSlides.ts';
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

describe('graph slide', () => {
  it('lands between the rule and the first worked example when commands exist', () => {
    const deck = buildLessonDeck('الدرس', true, {
      lesson: LESSON,
      plan: PLAN,
      graphCommands: ['f(x)=x^2-5x+6'],
    });
    const graphIdx = deck.slides.findIndex(s => s.type === 'graph');
    const firstExample = deck.slides.findIndex(s => s.type === 'challenge');
    assert.ok(graphIdx > 0, 'graph slide exists');
    assert.ok(firstExample > graphIdx, 'graph precedes the examples');
    assert.deepEqual(deck.slides[graphIdx]!.graphCommands, ['f(x)=x^2-5x+6']);
  });

  it('is omitted entirely when no commands were found — omit, never pad', () => {
    for (const commands of [undefined, [], ['']]) {
      const deck = buildLessonDeck('الدرس', true, {
        lesson: LESSON,
        plan: PLAN,
        graphCommands: commands,
      });
      assert.equal(deck.slides.some(s => s.type === 'graph'), false);
    }
  });

  it('keeps slide numbering consecutive with the graph slide inserted', () => {
    const deck = buildLessonDeck('الدرس', true, {
      lesson: LESSON,
      plan: PLAN,
      graphCommands: ['y=x^2'],
    });
    assert.deepEqual(numbersOf(deck), deck.slides.map((_, i) => i + 1));
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

// ── Formative checks ─────────────────────────────────────────────────────────
//
// A deck that teaches and never checks is a slideshow. These pin the two
// things that make the checks trustworthy rather than decorative: WHERE they
// land (the placement is the pedagogy — a check after the worked examples
// measures copying, one before them measures understanding), and that the
// deck never invents one.

function mcq(n: number, verifiedBy: 'symbolic' | 'bank' = 'bank') {
  return {
    slideNumber: n,
    type: 'question' as const,
    title: `سؤال ${n}`,
    content: `سؤال رقم ${n}؟`,
    options: [`أ${n}`, `ب${n}`, `ج${n}`, `د${n}`],
    correctIndex: 1,
    verified: true,
    verifiedBy,
    durationSeconds: 45,
  };
}

function checkTitles(slides: readonly { title: string }[], marker: string) {
  return slides.filter(s => s.title.includes(marker)).map(s => s.title);
}

describe('formative checks in the lesson deck', () => {
  it('places two mid-lesson checks and a three-question exit ticket', () => {
    const deck = buildLessonDeck('حل المعادلات التربيعية', true, {
      lesson: LESSON, plan: PLAN,
      checks: [mcq(1), mcq(2), mcq(3), mcq(4), mcq(5)],
    });
    assert.equal(checkTitles(deck.slides, 'تحقّق سريع').length, 2);
    assert.equal(checkTitles(deck.slides, 'تذكرة الخروج ').length, 3);
  });

  it('puts one mid-lesson check before the worked examples and one after', () => {
    const deck = buildLessonDeck('حل المعادلات التربيعية', true, {
      lesson: LESSON, plan: PLAN,
      checks: [mcq(1), mcq(2), mcq(3), mcq(4), mcq(5)],
    });
    const idx = (pred: (t: string) => boolean) => deck.slides.findIndex(s => pred(s.title));
    const firstExample = idx(t => t.startsWith('مثال'));
    const checks = deck.slides
      .map((s, i) => ({ i, t: s.title }))
      .filter(x => x.t.includes('تحقّق سريع'));
    assert.equal(checks.length, 2);
    assert.ok(firstExample > 0, 'the deck has worked examples to sit around');
    assert.ok(checks[0]!.i < firstExample, 'first check comes before the examples');
    assert.ok(checks[1]!.i > firstExample, 'second check comes after them');
  });

  it('puts the exit ticket after the summary, behind its own divider', () => {
    const deck = buildLessonDeck('حل المعادلات التربيعية', true, {
      lesson: LESSON, plan: PLAN,
      checks: [mcq(1), mcq(2), mcq(3), mcq(4), mcq(5)],
    });
    const summary = deck.slides.findIndex(s => s.type === 'summary');
    const divider = deck.slides.findIndex(s => s.type === 'divider' && s.content.includes('تذكرة الخروج'));
    const firstTicket = deck.slides.findIndex(s => s.title.includes('تذكرة الخروج '));
    assert.ok(summary >= 0 && divider > summary, 'divider follows the summary');
    assert.equal(firstTicket, divider + 1);
  });

  it('carries verification through untouched — it never re-derives it', () => {
    const deck = buildLessonDeck('حل المعادلات التربيعية', true, {
      lesson: LESSON, plan: PLAN,
      checks: [mcq(1, 'symbolic'), mcq(2), mcq(3), mcq(4), mcq(5)],
    });
    const first = deck.slides.find(s => s.title.includes('تحقّق سريع 1'))!;
    assert.equal(first.verified, true);
    assert.equal(first.verifiedBy, 'symbolic');
    assert.deepEqual(first.options, ['أ1', 'ب1', 'ج1', 'د1']);
    assert.equal(first.correctIndex, 1);
  });

  it('drops questionIndex — this deck has no scoring ledger to index into', () => {
    const deck = buildLessonDeck('حل المعادلات التربيعية', true, {
      lesson: LESSON, plan: PLAN,
      checks: [{ ...mcq(1), questionIndex: 0 }, mcq(2), mcq(3), mcq(4), mcq(5)],
    });
    const checks = deck.slides.filter(s => s.type === 'question');
    assert.ok(checks.length > 0);
    assert.ok(checks.every(s => s.questionIndex === undefined));
  });

  it('spends a spare question mid-lesson rather than faking an exit ticket', () => {
    const deck = buildLessonDeck('حل المعادلات التربيعية', true, {
      lesson: LESSON, plan: PLAN,
      checks: [mcq(1), mcq(2), mcq(3)],
    });
    // Three is one short of an exit ticket worth the name, so all three stay
    // mid-lesson — nothing is dropped and no one-question section appears.
    assert.equal(checkTitles(deck.slides, 'تحقّق سريع').length, 3);
    assert.equal(checkTitles(deck.slides, 'تذكرة الخروج').length, 0);
  });

  it('refuses a question slide with no usable options', () => {
    const deck = buildLessonDeck('حل المعادلات التربيعية', true, {
      lesson: LESSON, plan: PLAN,
      checks: [
        { ...mcq(1), options: [] },
        { ...mcq(2), correctIndex: 9 },
        { ...mcq(3), content: '   ' },
      ],
    });
    assert.equal(deck.slides.filter(s => s.type === 'question').length, 0);
  });

  it('accepts open write-on-your-board checks, so non-math lessons get them too', () => {
    // The generator returns these instead of fabricating options when it has
    // no verified bank for the subject. Gating checks on `subject === math`
    // is exactly the bug the chart work had to undo.
    const open = {
      slideNumber: 2,
      type: 'challenge' as const,
      title: 'سؤال 1',
      content: 'اشرح بكلماتك: التحليل إلى عاملين',
      durationSeconds: 60,
      teacher: { expectedAnswer: 'التحليل إلى عاملين' },
    };
    const deck = buildLessonDeck('حل المعادلات التربيعية', true, {
      lesson: LESSON, plan: PLAN, checks: [open, { ...open, slideNumber: 3 }],
    });
    assert.equal(checkTitles(deck.slides, 'تحقّق سريع').length, 2);
  });

  it('changes nothing when no checks are supplied', () => {
    const withChecks = buildLessonDeck('حل المعادلات التربيعية', true, { lesson: LESSON, plan: PLAN, checks: [] });
    const without = buildLessonDeck('حل المعادلات التربيعية', true, { lesson: LESSON, plan: PLAN });
    assert.deepEqual(withChecks.slides, without.slides);
  });

  it('keeps slideNumbers consecutive once checks are inserted', () => {
    const deck = buildLessonDeck('حل المعادلات التربيعية', true, {
      lesson: LESSON, plan: PLAN,
      checks: [mcq(1), mcq(2), mcq(3), mcq(4), mcq(5)],
    });
    deck.slides.forEach((s, i) => assert.equal(s.slideNumber, i + 1));
  });

  it('puts the checks in the printable answer key, keyed by their own title', () => {
    const deck = buildLessonDeck('حل المعادلات التربيعية', true, {
      lesson: LESSON, plan: PLAN,
      checks: [mcq(1), mcq(2), mcq(3), mcq(4), mcq(5)],
    });
    // The book example still numbers as an example; a check is keyed by its
    // section title, because "تذكرة الخروج 1" is the first exit-ticket
    // question and not the first question in the deck.
    assert.ok(deck.answerKey.some(k => k.startsWith('مثال 1:')));
    assert.ok(deck.answerKey.some(k => k.startsWith('✋ تحقّق سريع 1: ب1')));
    assert.ok(deck.answerKey.some(k => k.startsWith('🎫 تذكرة الخروج 1: ب3')));
  });

  it('leaves open checks out of the answer key rather than printing a blank row', () => {
    const open = {
      slideNumber: 2,
      type: 'challenge' as const,
      title: 'سؤال 1',
      content: 'اشرح بكلماتك: التحليل',
      durationSeconds: 60,
      teacher: { expectedAnswer: 'التحليل' },
    };
    const deck = buildLessonDeck('حل المعادلات التربيعية', true, { lesson: LESSON, plan: PLAN, checks: [open] });
    assert.ok(deck.answerKey.every(k => k.trim().length > 0));
    assert.ok(!deck.answerKey.some(k => k.includes('تحقّق سريع')));
  });
});

describe('splitChecks', () => {
  const q = (n: number) => mcq(n);

  it('gives 2 mid + 3 exit at five, the shape the deck is designed around', () => {
    const { mid, exit } = splitChecks([q(1), q(2), q(3), q(4), q(5)]);
    assert.equal(mid.length, 2);
    assert.equal(exit.length, 3);
  });

  it('never reuses a mid-lesson question at the door', () => {
    const { mid, exit } = splitChecks([q(1), q(2), q(3), q(4), q(5)]);
    const midContent = new Set(mid.map(s => s.content));
    assert.ok(exit.every(s => !midContent.has(s.content)));
  });

  it('gives 2 mid + 2 exit at four', () => {
    const { mid, exit } = splitChecks([q(1), q(2), q(3), q(4)]);
    assert.equal(mid.length, 2);
    assert.equal(exit.length, 2);
  });

  it('drops nothing at three, two or one', () => {
    assert.equal(splitChecks([q(1), q(2), q(3)]).mid.length, 3);
    assert.equal(splitChecks([q(1), q(2), q(3)]).exit.length, 0);
    assert.equal(splitChecks([q(1), q(2)]).mid.length, 2);
    assert.equal(splitChecks([q(1)]).mid.length, 1);
  });

  it('handles nothing at all', () => {
    assert.deepEqual(splitChecks(undefined), { mid: [], exit: [] });
    assert.deepEqual(splitChecks([]), { mid: [], exit: [] });
  });

  it('uses at most five, and takes them in order', () => {
    const { mid, exit } = splitChecks([q(1), q(2), q(3), q(4), q(5), q(6), q(7)]);
    assert.deepEqual([...mid, ...exit].map(s => s.content), [
      'سؤال رقم 1؟', 'سؤال رقم 2؟', 'سؤال رقم 3؟', 'سؤال رقم 4؟', 'سؤال رقم 5؟',
    ]);
  });
});
