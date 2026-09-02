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

import {
  BOOK_FIGURE_MAX, bookFigureCaption, buildLessonDeck, splitChecks, splitExample,
  splitWarmup, withoutSlide,
} from '../lessonSlides.ts';
import { figuresForLesson } from '../bookFigures.ts';
import { getLessonsForUnit, getUnitsForSubjectGrade } from '../knowledgeBase.ts';
import type { ActivitySlide, LessonPlanOutput } from '../ai/AIService.ts';
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

describe('practice slides', () => {
  // guidedPractice/independentPractice are the teacher's facilitation notes
  // (LESSON_STYLE_RULES_AR/EN in prompts.ts write them as pedagogy, never as
  // a line meant for a student to read off the screen). Projecting that
  // narration used to be exactly what this deck did.
  it('never projects the teacher narration onto the class-facing content', () => {
    const deck = buildLessonDeck('x', true, { lesson: LESSON, plan: PLAN });
    const guided = deck.slides.find(s => s.title.includes('تدريب موجّه'));
    const independent = deck.slides.find(s => s.title.includes('تدريب مستقل'));
    assert.ok(guided);
    assert.ok(independent);
    assert.equal(guided!.content.includes(PLAN.guidedPractice), false);
    assert.equal(independent!.content.includes(PLAN.independentPractice), false);
  });

  it('keeps the full narration available to the teacher panel', () => {
    const deck = buildLessonDeck('x', true, { lesson: LESSON, plan: PLAN });
    const guided = deck.slides.find(s => s.title.includes('تدريب موجّه'));
    const independent = deck.slides.find(s => s.title.includes('تدريب مستقل'));
    assert.equal(guided!.teacher?.teachingTips, PLAN.guidedPractice);
    assert.equal(independent!.teacher?.teachingTips, PLAN.independentPractice);
  });
});

describe('hook / introduction', () => {
  // PLAN.introduction ('ابدأ بسؤال عن مساحة حديقة.') has no quoted or
  // colon-introduced question, so splitWarmup falls through — the same
  // "narration, not a class-facing line" case as guidedPractice above.
  it('falls back to a generic prompt instead of the teacher narration when nothing can be lifted', () => {
    const deck = buildLessonDeck('x', true, { lesson: LESSON, plan: PLAN });
    const warmup = deck.slides.find(s => s.title.includes('تمهيد'));
    assert.ok(warmup);
    assert.equal(warmup!.content.includes(PLAN.introduction), false);
    assert.ok(warmup!.teacher?.teachingTips?.includes(PLAN.introduction));
  });

  it('still projects a lifted question directly, unchanged', () => {
    const quoted: LessonPlanOutput = { ...PLAN, introduction: 'اسأل الطلاب: "كم يساوي محيط المربع؟" ثم استمع لإجاباتهم.' };
    const deck = buildLessonDeck('x', true, { lesson: LESSON, plan: quoted });
    const warmup = deck.slides.find(s => s.title.includes('تمهيد'));
    assert.equal(warmup!.content, 'كم يساوي محيط المربع؟');
  });
});

describe('closure', () => {
  it('projects the synthesized summary, not the teacher narration', () => {
    const deck = buildLessonDeck('x', true, { lesson: LESSON, plan: PLAN });
    const summary = deck.slides.find(s => s.type === 'summary');
    assert.ok(summary);
    assert.equal(summary!.content.includes(PLAN.closure), false);
    assert.equal(summary!.teacher?.teachingTips, PLAN.closure);
  });

  it('needs no teacher panel when the plan has no closure text', () => {
    const deck = buildLessonDeck('x', true, { lesson: LESSON, plan: { ...PLAN, closure: '' } });
    const summary = deck.slides.find(s => s.type === 'summary');
    assert.equal(summary!.teacher, undefined);
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
    // Titles are bilingual now ("✋ تحقّق سريع 1 · Quick Check 1") since the
    // check's own question/options can come back in either language — match
    // on the Arabic half plus the answer rather than the whole prefix.
    assert.ok(deck.answerKey.some(k => k.includes('✋ تحقّق سريع 1') && k.endsWith(': ب1')));
    assert.ok(deck.answerKey.some(k => k.includes('🎫 تذكرة الخروج 1') && k.endsWith(': ب3')));
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

describe('checks that point at a figure', () => {
  /** The shape the live generator actually produced — the bug this covers. */
  const openCheck = (content: string): ActivitySlide => ({
    slideNumber: 2,
    type: 'challenge',
    title: 'سؤال 1',
    content,
    hint: 'ابدأ من نقطة التقاطع',
    answer: '(1 ، 2)',
    durationSeconds: 60,
  });

  const DANGLING = 'في الرسم البياني الظاهر، يلتقي المستقيمان عند النقطة التي تمثل حل النظام. حدّدوا إحداثيات نقطة التقاطع.';

  it('drops a check that claims a graph is on screen but carries none', () => {
    const { mid, exit } = splitChecks([openCheck(DANGLING), mcq(2), mcq(3), mcq(4), mcq(5)]);
    assert.ok(
      [...mid, ...exit].every(s => s.content !== DANGLING),
      'a question about an absent graph never reaches the projector',
    );
    assert.equal(mid.length + exit.length, 4);
  });

  it('keeps it, with the curves attached, when the stem names them', () => {
    const withEquations = openCheck(
      'في الرسم البياني الظاهر: y = x + 1 و y = -x + 3. حدّدوا إحداثيات نقطة التقاطع.',
    );
    const { mid } = splitChecks([withEquations]);
    assert.equal(mid.length, 1);
    assert.deepEqual(mid[0]!.graphCommands, ['y=x + 1', 'y=-x + 3']);
  });

  it('draws a system written the way the book writes it', () => {
    const system = openCheck('يمثل الرسم البياني النظام: y − x² = 7 − 5x و 4y − 8x = −21. ما حل النظام؟');
    const { mid } = splitChecks([system]);
    assert.equal(mid.length, 1, 'the check survives');
    assert.deepEqual(mid[0]!.graphCommands, ['y - x^2 = 7 - 5x', '4y - 8x = -21']);
  });

  it('keeps all of a figure or none of it', () => {
    // One drawable line, one circle this build cannot plot. Drawing the line
    // alone would contradict a stem that describes both.
    const half = openCheck('يمثل الرسم البياني النظام: x² + y² = 5 و x − y = 1. ما حل النظام؟');
    assert.equal(splitChecks([half]).mid.length, 0);
  });

  it('leaves an ordinary check alone — no figure claimed, no graph invented', () => {
    const plain = openCheck('أوجد حل المعادلة: x² - 5x + 6 = 0');
    const { mid } = splitChecks([plain]);
    assert.equal(mid.length, 1);
    assert.equal(mid[0]!.graphCommands, undefined);
  });

  it('does not read «ارسم الرسم البياني» as a claim that one is showing', () => {
    const draw = openCheck('ارسم الرسم البياني للاقتران ثم صف سلوكه.');
    assert.equal(splitChecks([draw]).mid.length, 1);
  });

  it('never borrows the deck-level graph for a check about something else', () => {
    const deck = buildLessonDeck('حل المعادلات التربيعية', true, {
      lesson: LESSON,
      plan: PLAN,
      graphCommands: ['f(x)=x^2'],
      checks: [openCheck(DANGLING)],
    });
    assert.ok(
      deck.slides.every(s => !s.content.includes('يلتقي المستقيمان')),
      'the parabola the lesson plots is not evidence for a question about two lines',
    );
  });
});

describe('splitWarmup', () => {
  it('projects only the question and keeps the stage directions for the teacher', () => {
    const intro = `ابدأ بطرح السؤال: “أين نلتقي بالأقواس في حياتنا؟” سجّل إجابات الطلاب على السبورة.`;
    const { projected, notes } = splitWarmup(intro);
    assert.equal(projected, 'أين نلتقي بالأقواس في حياتنا؟');
    assert.equal(notes, intro);
  });

  it('lifts an unquoted, colon-introduced question and keeps the rest for the teacher', () => {
    const intro = 'يبدأ المعلم بمراجعة سريعة لمفهوم حد وحيد، ثم ينتقل إلى سؤال تمهيدي: '
      + 'كيف يمكن جمع هذه الحدود أو ضربها لتكوين تعبيرات أكبر؟ بعد ذلك يوضح أن كثيرات '
      + 'الحدود تُعد من أهم أنواع الاقترانات.';
    const { projected, notes } = splitWarmup(intro);
    assert.equal(projected, 'كيف يمكن جمع هذه الحدود أو ضربها لتكوين تعبيرات أكبر؟');
    assert.equal(notes, intro);
  });

  it('projects the text unchanged when there is no quoted or colon-introduced question', () => {
    const intro = 'لعبة ما أعرفه: يكتب الطلاب ما يعرفونه عن الدرس.';
    assert.deepEqual(splitWarmup(intro), { projected: intro, notes: '' });
  });
});

describe('withoutSlide', () => {
  const slide = (title: string): ActivitySlide =>
    ({ slideNumber: 0, type: 'intro', title, content: title, durationSeconds: 0 });

  it('drops the slide it was handed and renumbers the rest', () => {
    const [a, b, c] = [slide('a'), slide('b'), slide('c')];
    const left = withoutSlide([a, b, c], b);
    assert.deepEqual(left.map(s => s.title), ['a', 'c']);
    assert.deepEqual(left.map(s => s.slideNumber), [1, 2]);
  });

  it('still drops the right slide after one was inserted ahead of it', () => {
    // What the index-based version got wrong: the video pass lands late and
    // everything after the insert shifts by one.
    const [a, b, video] = [slide('a'), slide('b'), slide('video')];
    const left = withoutSlide([a, video, b], b);
    assert.deepEqual(left.map(s => s.title), ['a', 'video']);
  });
});

describe('book figures on the deck', () => {
  // A real curriculum lesson that has figures, unlike the synthetic LESSON
  // above — the join is the thing under test, so a fixture would prove nothing.
  const WITH_FIGURES: KBLesson = { ...LESSON, id: 'kbl-math-s1-nccd-u1_l1' };
  const uri = (f: { file: string }) => `asset://${f.file}`;
  const figureSlides = (deck: { slides: ActivitySlide[] }) =>
    deck.slides.filter(s => s.type === 'media' && s.mediaUrl?.startsWith('asset://'));

  it('shows the lesson\'s own figures, captioned with the page', () => {
    const deck = buildLessonDeck('نظام معادلات', true, { lesson: WITH_FIGURES, figureUri: uri });
    const shown = figureSlides(deck);
    assert.ok(shown.length > 0, 'the lesson has figures and they reached the deck');
    const expected = figuresForLesson(WITH_FIGURES.id).slice(0, BOOK_FIGURE_MAX);
    assert.deepEqual(shown.map(s => s.mediaUrl), expected.map(uri));
    // The page number is what lets a teacher check the slide against the book.
    for (const s of shown) assert.match(s.mediaCaption ?? '', /صفحة/);
  });

  it('caps them, so a six-figure lesson is not six slides of looking', () => {
    const many = figuresForLesson('kbl-math-s2-nccd-u5_l2');
    assert.ok(many.length > BOOK_FIGURE_MAX, 'this lesson really does have more');
    const deck = buildLessonDeck('اقترانات نسبية', true, {
      lesson: { ...LESSON, id: 'kbl-math-s2-nccd-u5_l2' }, figureUri: uri,
    });
    assert.equal(figureSlides(deck).length, BOOK_FIGURE_MAX);
  });

  it('adds nothing when no resolver is passed — the pre-figures deck', () => {
    const before = buildLessonDeck('نظام معادلات', true, { lesson: WITH_FIGURES });
    assert.equal(figureSlides(before).length, 0);
  });

  it('drops a figure the bundler never got, rather than rendering it broken', () => {
    const deck = buildLessonDeck('نظام معادلات', true, {
      lesson: WITH_FIGURES, figureUri: () => null,
    });
    assert.equal(figureSlides(deck).length, 0);
  });

  it('adds nothing for a lesson with no figures at all', () => {
    const deck = buildLessonDeck('درس بلا أشكال', true, { lesson: LESSON, figureUri: uri });
    assert.equal(figureSlides(deck).length, 0);
  });

  it('keeps slide numbers consecutive with figures inserted', () => {
    const deck = buildLessonDeck('نظام معادلات', true, { lesson: WITH_FIGURES, figureUri: uri });
    assert.deepEqual(numbersOf(deck), deck.slides.map((_, i) => i + 1));
  });
});

describe('bookFigureCaption', () => {
  const figure = {
    file: 'p021.png', sourceId: 'math-s2-student-book', pdfPage: 21,
    unit: 1, lesson: 1, lessonTitleEn: null,
  };

  it('names the book, the semester and the page in Arabic digits', () => {
    assert.equal(bookFigureCaption(figure, true), 'كتاب الطالب · الفصل الثاني · صفحة ٢١');
  });

  it('stays latin in English', () => {
    assert.equal(bookFigureCaption(figure, false), 'Student Book · Semester 2 · page 21');
  });

  it('reads the semester off the source id', () => {
    const s1 = { ...figure, sourceId: 'math-s1-student-book' };
    assert.match(bookFigureCaption(s1, true), /الفصل الأول/);
  });
});

describe('bilingual chrome titles for the English subject', () => {
  // Reported from the running app: a Grade 10 English-track deck's "مفردات
  // الدرس" (Key Vocabulary) heading was Arabic-only even though the lesson
  // itself teaches English — a teacher or student who does not read the
  // Arabic label has no idea what the slide is. `opts.subject` is localised
  // (the caller passes "English" or «اللغة الإنجليزية» depending on the app's
  // UI language), so both spellings must trigger it.
  const ENGLISH_PLAN: LessonPlanOutput = { ...PLAN, subject: 'English' };

  it('shows every section heading in both languages when subject is English', () => {
    const deck = buildLessonDeck('Farm Equipment', true, {
      plan: ENGLISH_PLAN, subject: 'English',
    });
    const summary = deck.slides.find(s => s.type === 'summary')!;
    assert.match(summary.title, /ملخص الدرس/);
    assert.match(summary.title, /Lesson Summary/);
  });

  it('recognises the Arabic subject label too', () => {
    const deck = buildLessonDeck('معدات المزرعة', true, {
      plan: ENGLISH_PLAN, subject: 'اللغة الإنجليزية',
    });
    const summary = deck.slides.find(s => s.type === 'summary')!;
    assert.match(summary.title, /Lesson Summary/);
  });

  it('trusts the lesson\'s own book over the subject string when both are present', () => {
    // A real English-track KB lesson (Grade 10 Agriculture, Unit 1) rather
    // than a fabricated unitId — getBookForLesson resolves through the real
    // KB_UNITS/KB_BOOKS tables, so a made-up id would just resolve to nothing.
    const unit = getUnitsForSubjectGrade('english', 'grade-10')[0]!;
    const englishLesson = getLessonsForUnit(unit.id)[0]!;
    const deck = buildLessonDeck(englishLesson.titleAr, true, {
      lesson: englishLesson, plan: ENGLISH_PLAN,
      // Deliberately wrong subject string — a mismatched caller must not
      // suppress the bilingual heading the book itself calls for.
      subject: 'الرياضيات',
    });
    const vocab = deck.slides.find(s => s.title.includes('مفردات الدرس'));
    assert.ok(vocab, 'the lesson has key terms, so a vocabulary slide exists');
    assert.match(vocab!.title, /Key Vocabulary/);
  });

  it('leaves a non-English deck single-language, exactly as before', () => {
    const deck = buildLessonDeck('حل المعادلات التربيعية', true, { lesson: LESSON, plan: PLAN });
    const summary = deck.slides.find(s => s.type === 'summary')!;
    assert.equal(summary.title, '🎉 ملخص الدرس');
  });

  it('still bilinguals the numbered check titles regardless of subject', () => {
    const deck = buildLessonDeck('حل المعادلات التربيعية', true, {
      lesson: LESSON, plan: PLAN, checks: [mcq(1), mcq(2), mcq(3), mcq(4), mcq(5)],
    });
    const check = deck.slides.find(s => s.title.includes('تحقّق سريع 1'))!;
    assert.match(check.title, /Quick Check 1/);
  });
});
