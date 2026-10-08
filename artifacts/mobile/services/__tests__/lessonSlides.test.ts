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
  splitWarmup, usableTeaching, withoutSlide,
} from '../lessonSlides.ts';
import { figuresForLesson } from '../bookFigures.ts';
import { KB_LESSONS } from '../knowledgeBase.ts';
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

  // The split above leaves these two slides with a single projected line, so
  // they look broken on a wall. `teacherLed` is what lets the presenter say
  // the substance is one tap away, and it has to stay ON exactly these two:
  // the warm-up and example slides share the type AND the teacher panel but
  // carry real content, so a cue on them would be noise.
  it('marks the practice slides as teacher-led, and only those', () => {
    const deck = buildLessonDeck('x', true, { lesson: LESSON, plan: PLAN });
    const guided = deck.slides.find(s => s.title.includes('تدريب موجّه'));
    const independent = deck.slides.find(s => s.title.includes('تدريب مستقل'));
    assert.equal(guided!.teacherLed, true);
    assert.equal(independent!.teacherLed, true);

    const flagged = deck.slides.filter(s => s.teacherLed).map(s => s.title);
    assert.equal(flagged.length, 2, `unexpected teacher-led slides: ${flagged.join(' | ')}`);

    // A cue that points at an empty panel is worse than no cue.
    for (const s of deck.slides.filter(x => x.teacherLed)) {
      assert.ok(s.teacher?.teachingTips, `${s.title} is teacher-led with no teachingTips`);
    }
  });
});

describe('hook / introduction', () => {
  // PLAN.introduction ('ابدأ بسؤال عن مساحة حديقة.') has no quoted or
  // colon-introduced question, so splitWarmup falls through — the same
  // "narration, not a class-facing line" case as guidedPractice above.
  // It used to project «لنبدأ بسؤال يهيّئنا لموضوع اليوم.» here: a slide
  // announcing a question and then asking none.
  it('drops the warm-up slide when there is no question to lift', () => {
    const deck = buildLessonDeck('x', true, { lesson: LESSON, plan: PLAN });
    assert.equal(deck.slides.some(s => s.title.includes('تمهيد')), false);
    assert.equal(deck.slides.some(s => s.content.includes(PLAN.introduction)), false);
  });

  it('still projects a lifted question directly, unchanged', () => {
    const quoted: LessonPlanOutput = { ...PLAN, introduction: 'اسأل الطلبة: "كم يساوي محيط المربع؟" ثم استمع لإجاباتهم.' };
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
    const concepts = deck.slides.filter(s => s.title.includes('Key Ideas'));
    assert.ok(concepts.length > 0);
    assert.ok(concepts[0].content.includes('Standard form'));
    assert.equal(concepts.some(s => s.content.includes('الصيغة')), false);
  });

  it('reads the Arabic fields when building an Arabic deck', () => {
    const deck = buildLessonDeck('حل المعادلات التربيعية', true, { lesson: LESSON });
    const concepts = deck.slides.filter(s => s.title.includes('أفكار الدرس'));
    assert.ok(concepts[0].content.includes('الصيغة العامة'));
  });
});

describe('concept slides', () => {
  const withConcepts = (keyConceptsAr: string[], extra: Partial<KBLesson> = {}) =>
    buildLessonDeck('معادلة الدائرة', true, { lesson: { ...LESSON, keyConceptsAr, ...extra } });

  it('never titles a slide «الفكرة n»', () => {
    const deck = withConcepts(['المركز (h, k) ونصف القطر r', 'إكمال المربع لإيجاد المركز']);
    assert.equal(deck.slides.some(s => s.title.startsWith('الفكرة')), false);
  });

  it('groups bare one-line concepts onto one bulleted slide', () => {
    const deck = withConcepts(['المركز (h, k) ونصف القطر r', 'إكمال المربع لإيجاد المركز']);
    const ideas = deck.slides.filter(s => s.title.includes('أفكار الدرس'));
    assert.equal(ideas.length, 1);
    assert.equal(ideas[0]!.content, '• المركز (h, k) ونصف القطر r\n• إكمال المربع لإيجاد المركز');
  });

  it('keeps bare concepts together when a titled one falls between them', () => {
    const deck = withConcepts(['المركز (h, k) ونصف القطر r', 'الصورة العامة: x²+y²+Dx+Ey+F=0', 'إكمال المربع لإيجاد المركز']);
    const titles = deck.slides.map(s => s.title);
    assert.equal(titles.filter(t => t.includes('أفكار الدرس')).length, 1);
    assert.ok(titles.indexOf('💡 أفكار الدرس') < titles.indexOf('الصورة العامة'));
  });

  it('titles a labelled concept by its own label', () => {
    const deck = withConcepts(['الصورة العامة: x²+y²+Dx+Ey+F=0']);
    const slide = deck.slides.find(s => s.title === 'الصورة العامة');
    assert.ok(slide);
    assert.equal(slide!.content, 'x²+y²+Dx+Ey+F=0');
  });

  it('drops a concept the rule slide already states', () => {
    const deck = withConcepts(['معادلة الدائرة: (x−h)²+(y−k)²=r²', 'إكمال المربع لإيجاد المركز'], {
      rulesAr: ['معادلة الدائرة: (x−h)² + (y−k)² = r²'],
    });
    const formulaSlides = deck.slides.filter(s => s.content.replace(/\s+/g, '').includes('(x−h)²+(y−k)²=r²'));
    assert.equal(formulaSlides.length, 1, formulaSlides.map(s => s.title).join(' | '));
  });
});

describe('cover and summary', () => {
  const twoSentences = { ...LESSON, summaryAr: 'المعادلة التربيعية لها جذران على الأكثر. نحلّها بالتحليل إلى عاملين.' };

  it('keeps the book summary off the cover', () => {
    const deck = buildLessonDeck('x', true, { lesson: twoSentences, subject: 'الرياضيات', grade: 'الصف العاشر' });
    assert.equal(deck.slides[0]!.content, 'الرياضيات · الصف العاشر');
  });

  it('closes on the book summary as takeaways', () => {
    const deck = buildLessonDeck('x', true, { lesson: twoSentences });
    const summary = deck.slides.find(s => s.type === 'summary')!;
    assert.equal(summary.content, '• المعادلة التربيعية لها جذران على الأكثر\n• نحلّها بالتحليل إلى عاملين');
  });

  it('falls back to the outcomes when the summary is a single sentence', () => {
    const deck = buildLessonDeck('x', true, { lesson: LESSON });
    const summary = deck.slides.find(s => s.type === 'summary')!;
    assert.ok(summary.content.includes('حل المعادلة التربيعية بالتحليل'));
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

  // The book's own examples, as stored. The colon form used to be projected
  // whole — answer included — and an arrow chain left its working on the wall.
  it('hides the answer of a «givens: solution» example behind the reveal', () => {
    assert.deepEqual(
      splitExample('دائرة مركزها (2,−3) ونصف قطرها 5: (x−2)²+(y+3)²=25'),
      ['دائرة مركزها (2,−3) ونصف قطرها 5', '(x−2)²+(y+3)²=25'],
    );
    assert.deepEqual(
      splitExample('v = ⟨3, 4⟩: |v| = √(9+16) = √25 = 5'),
      ['v = ⟨3, 4⟩', '|v| = √(9+16) = √25 = 5'],
    );
  });

  it('keeps the working with the answer, not with the question', () => {
    const [problem, answer] = splitExample("f(x) = −x² + 4x: f'(x) = −2x + 4 = 0 → x = 2، قيمة عظمى = f(2) = 4");
    assert.equal(problem, 'f(x) = −x² + 4x');
    assert.ok(answer.startsWith("f'(x)") && answer.includes('→ x = 2'));
  });

  it('splits at the last colon when the givens themselves contain one', () => {
    const [problem, answer] = splitExample('مثلث قائم: الوتر=10، مقابل زاوية A = 6: sin A = 6/10 = 0.6 → A = 37°');
    assert.equal(problem, 'مثلث قائم: الوتر=10، مقابل زاوية A = 6');
    assert.equal(answer, 'sin A = 6/10 = 0.6 → A = 37°');
  });

  it('never hides a definition that has no working in it', () => {
    assert.deepEqual(splitExample('الفاعل: اسم مرفوع يأتي بعد الفعل'), ['الفاعل: اسم مرفوع يأتي بعد الفعل', '']);
    assert.deepEqual(splitExample('النسبة 3:4 بين العددين'), ['النسبة 3:4 بين العددين', '']);
  });

  it('lets an explicit label win over a colon in the answer', () => {
    assert.deepEqual(splitExample('احسب المساحة الجواب: A = 5 × 4 = 20'), ['احسب المساحة', 'A = 5 × 4 = 20']);
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
    const divider = deck.slides.findIndex(s => s.type === 'divider' && s.title.includes('تذكرة الخروج'));
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
    const intro = `ابدأ بطرح السؤال: “أين نلتقي بالأقواس في حياتنا؟” سجّل إجابات الطلبة على السبورة.`;
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
    const intro = 'لعبة ما أعرفه: يكتب الطلبة ما يعرفونه عن الدرس.';
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
  /**
   * A figure attached BESIDE a slide's text rather than given its own slide.
   *
   * The rule slide takes the first figure this way, so counting only
   * standalone `media` slides now under-counts what a lesson actually shows —
   * which is the whole point of the change and the reason these assertions
   * moved rather than being deleted.
   */
  const sideFigures = (deck: { slides: ActivitySlide[] }) =>
    deck.slides.filter(s => s.sideImageUrl?.startsWith('asset://'));
  const allFigures = (deck: { slides: ActivitySlide[] }) =>
    [...sideFigures(deck).map(s => s.sideImageUrl), ...figureSlides(deck).map(s => s.mediaUrl)];

  it('shows the lesson\'s own figures, captioned with the page', () => {
    const deck = buildLessonDeck('نظام معادلات', true, { lesson: WITH_FIGURES, figureUri: uri });
    const shown = allFigures(deck);
    assert.ok(shown.length > 0, 'the lesson has figures and they reached the deck');
    const expected = figuresForLesson(WITH_FIGURES.id).slice(0, BOOK_FIGURE_MAX);
    assert.deepEqual(shown, expected.map(uri));
    // The page number is what lets a teacher check the slide against the book,
    // whether it is beside the text or on a slide of its own.
    for (const s of figureSlides(deck)) assert.match(s.mediaCaption ?? '', /صفحة/);
    for (const s of sideFigures(deck)) assert.match(s.sideImageCaption ?? '', /صفحة/);
  });

  it('puts the first one BESIDE the rule it illustrates, not on the next slide', () => {
    // The deck was a single column throughout, so «العمود النازل من المركز
    // ينصّف الوتر» and the book's drawing of exactly that were a click apart.
    const deck = buildLessonDeck('نظام معادلات', true, { lesson: WITH_FIGURES, figureUri: uri });
    const rule = deck.slides.find(s => s.title.includes('القاعدة'));
    assert.ok(rule, 'the fixture lesson states a rule');
    assert.ok(rule!.sideImageUrl?.startsWith('asset://'), 'the rule slide carries the figure');
    assert.match(rule!.sideImageCaption ?? '', /صفحة/);
    // And it is not ALSO a slide of its own.
    assert.ok(
      !figureSlides(deck).some(s => s.mediaUrl === rule!.sideImageUrl),
      'the same figure must not appear twice',
    );
  });

  it('leaves every figure standalone when the lesson states no rule', () => {
    // Nothing to sit beside, so nothing is attached and the deck is exactly
    // what it was before the split layout existed.
    const noRule: KBLesson = { ...WITH_FIGURES, rulesAr: [], rulesEn: [] };
    const deck = buildLessonDeck('نظام معادلات', true, { lesson: noRule, figureUri: uri });
    assert.equal(sideFigures(deck).length, 0);
    assert.equal(figureSlides(deck).length, BOOK_FIGURE_MAX);
  });

  it('caps them, so a six-figure lesson is not six slides of looking', () => {
    const many = figuresForLesson('kbl-math-s2-nccd-u5_l2');
    assert.ok(many.length > BOOK_FIGURE_MAX, 'this lesson really does have more');
    const deck = buildLessonDeck('اقترانات نسبية', true, {
      lesson: { ...LESSON, id: 'kbl-math-s2-nccd-u5_l2' }, figureUri: uri,
    });
    // The cap is on figures shown, not on slides spent — one of them may now
    // be riding along beside the rule instead of occupying a slide.
    assert.equal(allFigures(deck).length, BOOK_FIGURE_MAX);
  });

  it('adds nothing when no resolver is passed — the pre-figures deck', () => {
    const before = buildLessonDeck('نظام معادلات', true, { lesson: WITH_FIGURES });
    assert.equal(allFigures(before).length, 0);
  });

  it('drops a figure the bundler never got, rather than rendering it broken', () => {
    const deck = buildLessonDeck('نظام معادلات', true, {
      lesson: WITH_FIGURES, figureUri: () => null,
    });
    assert.equal(allFigures(deck).length, 0);
    // And the rule slide stays a plain single column rather than reserving
    // half its width for a picture that never arrives.
    const rule = deck.slides.find(s => s.title.includes('القاعدة'));
    assert.equal(rule?.sideImageUrl, undefined);
  });

  it('adds nothing for a lesson with no figures at all', () => {
    const deck = buildLessonDeck('درس بلا أشكال', true, { lesson: LESSON, figureUri: uri });
    assert.equal(allFigures(deck).length, 0);
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

describe('one language per deck', () => {
  // English-subject decks used to carry bilingual headings («مفردات الدرس ·
  // Key Vocabulary») over an Arabic-UI deck. They are now built in English
  // (`contentLang`), so the headings are English and nothing else.
  it('builds an English-subject deck with English-only headings', () => {
    // A real English-track KB lesson, named rather than taken as `[0]` of its
    // unit list — general English arrived in front of the vocational tracks on
    // 2026-09-05 and a positional pick silently became a lesson with no key
    // terms, so the vocabulary slide asserted on stopped existing.
    const englishLesson = KB_LESSONS.find(l => l.id === 'kbl-eng-agri-s1-nccd-u1_l1')!;
    assert.ok(englishLesson, 'the agriculture-track lesson still exists');
    const deck = buildLessonDeck(englishLesson.titleEn, false, {
      lesson: englishLesson, subject: 'English',
      checks: [mcq(1), mcq(2), mcq(3), mcq(4), mcq(5)],
    });
    const vocab = deck.slides.find(s => s.title.includes('Key Vocabulary'));
    assert.ok(vocab, 'the lesson has key terms, so a vocabulary slide exists');
    assert.equal(vocab!.title, '📖 Key Vocabulary');
    assert.ok(deck.slides.some(s => s.title === 'Quick Check 1'));
    assert.ok(deck.slides.some(s => s.title === 'Exit Ticket 1'));
    for (const s of deck.slides) assert.doesNotMatch(s.title, /[؀-ۿ]/, s.title);
  });

  it('leaves a non-English deck single-language, exactly as before', () => {
    const deck = buildLessonDeck('حل المعادلات التربيعية', true, { lesson: LESSON, plan: PLAN });
    const summary = deck.slides.find(s => s.type === 'summary')!;
    assert.equal(summary.title, '🎉 ملخص الدرس');
  });

  it('leaves the numbered check titles single-language outside the English subject', () => {
    const deck = buildLessonDeck('حل المعادلات التربيعية', true, {
      lesson: LESSON, plan: PLAN, checks: [mcq(1), mcq(2), mcq(3), mcq(4), mcq(5)],
    });
    const check = deck.slides.find(s => s.title.includes('تحقّق سريع 1'))!;
    assert.equal(check.title, '✋ تحقّق سريع 1');
    const exit = deck.slides.find(s => s.title.includes('تذكرة الخروج 1'))!;
    assert.equal(exit.title, '🎫 تذكرة الخروج 1');
  });
});

// ─── The generated explanation section (/generate/lesson-teaching) ──────────
// For 14 of 17 G10 chemistry lessons the book data carries no concept, rule
// or example, so the deck taught nothing. These pin how the generated section
// fills that without displacing anything the book does supply.
const TEACHING = {
  hook: { question: 'لماذا نقيس الذرّات بالمول لا بالعدد؟', teacherNote: 'دع الطلبة يخمّنون' },
  concepts: [
    { title: 'المول يربط عدد الجسيمات بكتلة المادة', points: ['المول 6.02×10²³ جسيمًا', 'مول الكربون كتلته 12 g'], teacherNote: 'أكّد على الوحدة', misconception: 'المول وحدة كتلة' },
    { title: 'الكتلة المولية كتلة مول واحد', points: ['• تُقاس بـ g/mol'] },
  ],
  workedExample: { problem: 'كم مولًا في 36 g من الماء؟ (الكتلة المولية 18 g/mol)', steps: ['n = m ÷ M', 'n = 36 ÷ 18'], answer: '2 mol' },
  practice: { problem: 'كم مولًا في 88 g من CO₂؟ (44 g/mol)', hint: 'اقسم الكتلة على الكتلة المولية', answer: '2 mol' },
};
const BARE: KBLesson = { ...LESSON, keyConceptsAr: [], rulesAr: [], examplesAr: [] };

describe('usableTeaching', () => {
  it('keeps a well-formed section and strips a bullet the model added itself', () => {
    const t = usableTeaching(TEACHING);
    assert.equal(t.concepts.length, 2);
    assert.deepEqual(t.concepts[1]!.points, ['تُقاس بـ g/mol']);
    assert.ok(t.hook && t.workedExample && t.practice);
  });

  it('drops a concept with no title or no points', () => {
    const t = usableTeaching({ concepts: [{ title: '', points: ['x'] }, { title: 'فكرة', points: [' '] }] });
    assert.deepEqual(t.concepts, []);
  });

  it('drops a worked example whose problem already shows its answer', () => {
    const t = usableTeaching({ workedExample: { problem: 'مركزها (2,−3) ونصف قطرها 5: (x−2)²+(y+3)²=25', steps: ['عوّض'], answer: '(x−2)² + (y+3)² = 25' } });
    assert.equal(t.workedExample, null);
  });

  it('drops a worked example whose problem already contains a short answer like x = 4', () => {
    const t = usableTeaching({ workedExample: { problem: 'إذا كان x = 4 فما قيمة 2x + 1؟', steps: ['عوّض'], answer: 'x = 4' } });
    assert.equal(t.workedExample, null);
  });

  it('keeps a worked example whose short answer merely appears as a number', () => {
    const t = usableTeaching({ workedExample: { problem: 'حل x² − 16 = 0 حيث x > 0', steps: ['x² = 16'], answer: '4' } });
    assert.ok(t.workedExample);
  });

  it('caps the explanation at five slides', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ title: `فكرة ${i}`, points: ['سطر'] }));
    assert.equal(usableTeaching({ concepts: many }).concepts.length, 5);
  });

  it('treats garbage as nothing', () => {
    const t = usableTeaching(null);
    assert.deepEqual(t, { hook: null, concepts: [], workedExample: null, practice: null });
    assert.deepEqual(usableTeaching({ concepts: 'x' as never }).concepts, []);
  });
});

describe('generated explanation in the deck', () => {
  it('teaches a lesson whose book data has no concepts, rule or examples', () => {
    const deck = buildLessonDeck('المول', true, { lesson: BARE, plan: PLAN, teaching: TEACHING });
    const titles = deck.slides.map(s => s.title);
    assert.ok(titles.includes('المول يربط عدد الجسيمات بكتلة المادة'));
    assert.ok(deck.slides.some(s => s.type === 'divider'), 'the explanation gets its section break');
    const example = deck.slides.find(s => s.type === 'challenge')!;
    assert.equal(example.content, TEACHING.workedExample.problem);
    assert.equal(example.answer, '2 mol');
    assert.equal(example.teacher?.expectedAnswer, '1. n = m ÷ M\n2. n = 36 ÷ 18');
  });

  it('puts the misconception and note in the teacher panel, bullets on screen', () => {
    const deck = buildLessonDeck('المول', true, { lesson: BARE, teaching: TEACHING });
    const c = deck.slides.find(s => s.title === 'المول يربط عدد الجسيمات بكتلة المادة')!;
    assert.equal(c.content, '• المول 6.02×10²³ جسيمًا\n• مول الكربون كتلته 12 g');
    assert.equal(c.teacher?.commonMisconceptions, 'المول وحدة كتلة');
    assert.equal(c.teacher?.teachingTips, 'أكّد على الوحدة');
  });

  it('replaces the book concept lines but keeps the book rule verbatim', () => {
    const deck = buildLessonDeck('x', true, { lesson: LESSON, teaching: TEACHING });
    assert.equal(deck.slides.some(s => s.title.includes('أفكار الدرس')), false);
    const rule = deck.slides.find(s => s.title.includes('القاعدة'))!;
    assert.ok(rule.content.includes(LESSON.rulesAr![0]!));
  });

  it("never replaces the book's own worked examples", () => {
    const deck = buildLessonDeck('x', true, { lesson: LESSON, teaching: TEACHING });
    const examples = deck.slides.filter(s => s.type === 'challenge');
    assert.equal(examples.length, 1);
    assert.equal(examples[0]!.answer, 'x = 2 أو x = 3');
  });

  it("uses the generated hook only when the plan's warm-up has no question", () => {
    const narrated = buildLessonDeck('x', true, { lesson: BARE, plan: PLAN, teaching: TEACHING });
    assert.equal(narrated.slides.find(s => s.title.includes('تمهيد'))!.content, TEACHING.hook.question);

    const quoted: LessonPlanOutput = { ...PLAN, introduction: 'اسأل الطلبة: "كم يساوي محيط المربع؟" ثم استمع.' };
    const planWins = buildLessonDeck('x', true, { lesson: BARE, plan: quoted, teaching: TEACHING });
    assert.equal(planWins.slides.find(s => s.title.includes('تمهيد'))!.content, 'كم يساوي محيط المربع؟');
  });

  it('projects the practice problem, with the answer only in the teacher panel', () => {
    const deck = buildLessonDeck('x', true, { lesson: BARE, plan: PLAN, teaching: TEACHING });
    const guided = deck.slides.find(s => s.title.includes('تدريب موجّه'))!;
    assert.equal(guided.content, TEACHING.practice.problem);
    assert.equal(guided.teacherLed, undefined);
    assert.equal(guided.teacher?.expectedAnswer, '2 mol');
    assert.ok(guided.teacher?.teachingTips?.includes(PLAN.guidedPractice));
    assert.equal(guided.content.includes('2 mol'), false);
  });

  it('keeps the practice problem out of the answer key numbering', () => {
    const deck = buildLessonDeck('x', true, { lesson: BARE, plan: PLAN, teaching: TEACHING });
    assert.deepEqual(deck.answerKey, ['مثال 1: 2 mol']);
  });

  it('flags every generated slide, and no book slide, as aiWritten', () => {
    const deck = buildLessonDeck('المول', true, { lesson: BARE, plan: PLAN, teaching: TEACHING });
    const flagged = deck.slides.filter(s => s.aiWritten).map(s => s.title);
    assert.deepEqual(flagged, [
      '✨ تمهيد',
      'المول يربط عدد الجسيمات بكتلة المادة',
      'الكتلة المولية كتلة مول واحد',
      'مثال 1',
      '🤝 تدريب موجّه',
    ]);
    const book = buildLessonDeck('x', true, { lesson: LESSON, plan: PLAN });
    assert.equal(book.slides.some(s => s.aiWritten), false);
  });

  it('tells the teacher which slides the AI wrote', () => {
    const deck = buildLessonDeck('x', true, { lesson: LESSON, teaching: TEACHING });
    assert.match(deck.teacherPreparation, /الذكاء الاصطناعي/);
    const plain = buildLessonDeck('x', true, { lesson: LESSON });
    assert.doesNotMatch(plain.teacherPreparation, /الذكاء الاصطناعي/);
  });

  it('builds exactly the old deck when the section is missing or unusable', () => {
    const before = buildLessonDeck('x', true, { lesson: LESSON, plan: PLAN });
    for (const teaching of [undefined, null, { concepts: [] }]) {
      const after = buildLessonDeck('x', true, { lesson: LESSON, plan: PLAN, teaching });
      assert.deepEqual(after, before);
    }
  });
});

describe('opening order', () => {
  const two: KBLesson = {
    ...LESSON,
    keyTerms: [
      { ar: 'الجذر', en: 'Root', definitionAr: 'قيمة تحقق المعادلة', definitionEn: 'A value satisfying the equation' },
      { ar: 'المميّز', en: 'Discriminant', definitionAr: 'b² − 4ac', definitionEn: 'b² − 4ac' },
    ],
  };
  const build = (lesson: KBLesson, extra: Record<string, unknown> = {}) =>
    buildLessonDeck('حل المعادلات التربيعية', true, { lesson, plan: PLAN, ...extra });
  const at = (deck: { slides: ActivitySlide[] }, pick: (s: ActivitySlide) => boolean) => deck.slides.findIndex(pick);

  it('runs title, outcomes, warm-up, section break, vocabulary, explanation', () => {
    const deck = build(two, { teaching: TEACHING });
    const outcomes = at(deck, s => s.title.includes('نتاجات'));
    const warmup = at(deck, s => s.title.includes('تمهيد'));
    const divider = at(deck, s => s.type === 'divider');
    const vocab = at(deck, s => s.title.includes('مفردات'));
    assert.equal(outcomes, 1, 'the outcomes slide teachers must show comes straight after the cover');
    assert.ok(warmup > outcomes, 'the warm-up follows the outcomes');
    assert.ok(divider > warmup, 'the section break follows the warm-up');
    assert.equal(vocab, divider + 1, 'vocabulary is the first slide after the break');
    assert.ok(at(deck, s => s.title === TEACHING.concepts[0]!.title) > vocab, 'then the explanation');
  });

  it('puts the section name on the divider and the lesson under it', () => {
    const deck = build(two, { teaching: TEACHING });
    const divider = deck.slides[at(deck, s => s.type === 'divider')]!;
    assert.equal(divider.title, 'لنبدأ الشرح');
    assert.equal(divider.content, 'حل المعادلات التربيعية');
  });

  it('gives the exit-ticket divider the same shape', () => {
    const deck = build(two, { checks: [mcq(1), mcq(2), mcq(3), mcq(4), mcq(5)] });
    const exit = deck.slides.filter(s => s.type === 'divider').pop()!;
    assert.equal(exit.title, 'تذكرة الخروج');
    assert.equal(exit.content, 'حل المعادلات التربيعية');
  });

  it('keeps a vocabulary list of two or more terms as one slide', () => {
    const vocab = build(two).slides.find(s => s.title.includes('مفردات'))!;
    assert.match(vocab.content, /الجذر — قيمة تحقق المعادلة/);
    assert.match(vocab.content, /المميّز/);
  });

  it('draws a lone defined term as a titled slide, not a one-item list', () => {
    const deck = build(LESSON);   // one key term, «الجذر», with a definition
    assert.equal(at(deck, s => s.title.includes('مفردات')), -1);
    const term = deck.slides.find(s => s.title === 'الجذر')!;
    assert.ok(term, 'the term still reaches the deck');
    assert.equal(term.content, 'قيمة تحقق المعادلة');
  });

  it('does not draw a lone term twice when the explanation already has it as a concept', () => {
    const lesson: KBLesson = { ...LESSON, keyConceptsAr: ['الجذر', 'التحليل إلى عاملين'] };
    assert.equal(build(lesson).slides.filter(s => s.title === 'الجذر').length, 1);
  });

  it('adds nothing for a lone term that has no definition', () => {
    const lesson = { ...LESSON, keyTerms: [{ ar: 'الجذر', en: 'Root' }] } as unknown as KBLesson;
    const deck = build(lesson);
    assert.equal(at(deck, s => s.title === 'الجذر'), -1);
    assert.equal(at(deck, s => s.title.includes('مفردات')), -1);
  });

  it('puts vocabulary straight after the warm-up when there is no explanation to break to', () => {
    const lesson: KBLesson = { ...two, keyConceptsAr: [], keyConceptsEn: [] };
    const deck = build(lesson, { teaching: { ...TEACHING, concepts: [] } });
    assert.equal(at(deck, s => s.type === 'divider'), -1, 'no explanation, no break');
    assert.equal(at(deck, s => s.title.includes('مفردات')), at(deck, s => s.title.includes('تمهيد')) + 1);
  });
});

describe('buildLessonDeck — a rule written as a one-line procedure', () => {
  const procedure = 'الخطوات: 1) عزل y من المعادلة الخطية 2) تعويضه في التربيعية 3) حل المعادلة الناتجة';
  const withProcedure: KBLesson = { ...LESSON, rulesAr: [procedure] };

  it('is drawn as numbered steps, one per line', () => {
    const rule = buildLessonDeck('نظام معادلات', true, { lesson: withProcedure })
      .slides.find(s => s.title.includes('القاعدة'))!;
    assert.equal(rule.layout, 'steps');
    assert.equal(rule.content, '• عزل y من المعادلة الخطية\n• تعويضه في التربيعية\n• حل المعادلة الناتجة');
  });

  it('keeps an ordinary rule exactly as before', () => {
    const plain: KBLesson = { ...LESSON, rulesAr: ['حل النظام يكون بالتعويض', 'يمكن التحقق بيانيًا'] };
    const rule = buildLessonDeck('نظام معادلات', true, { lesson: plain })
      .slides.find(s => s.title.includes('القاعدة'))!;
    assert.equal(rule.layout, undefined);
    assert.equal(rule.content, '• حل النظام يكون بالتعويض\n• يمكن التحقق بيانيًا');
  });

  it('does not take the layout when the rule has a figure beside it', () => {
    const figured: KBLesson = { ...withProcedure, id: 'kbl-math-s1-nccd-u1_l1' };
    const rule = buildLessonDeck('نظام معادلات', true, {
      lesson: figured, figureUri: (f: { file: string }) => `asset://${f.file}`,
    }).slides.find(s => s.title.includes('القاعدة'))!;
    assert.ok(rule.sideImageUrl, 'the fixture lesson has figures');
    assert.equal(rule.layout, undefined);
    assert.match(rule.content, /الخطوات: 1\)/);
  });
});

import { resolveSlideLayout } from '../slideLayout.ts';

describe('a short figure with a name', () => {
  const lesson = (concepts: string[]): KBLesson => ({
    ...LESSON, keyConceptsAr: concepts, keyConceptsEn: concepts, keyTerms: [], rulesAr: [], rulesEn: [],
  });
  const slideTitled = (concepts: string[], title: string) =>
    buildLessonDeck('درس', true, { lesson: lesson(concepts), plan: PLAN }).slides.find(s => s.title === title);

  it('is drawn as a stat — the figure large, its name beneath', () => {
    const s = slideTitled(['الحلول الممكنة: 0 أو 1 أو 2', 'فكرة ثانية: شرح طويل لا يصلح أن يكون رقمًا'], 'الحلول الممكنة')!;
    assert.equal(s.layout, 'stat');
    assert.deepEqual(s.stat, { value: '0 أو 1 أو 2', label: 'الحلول الممكنة' });
    assert.equal(resolveSlideLayout(s)?.kind, 'stat', 'every renderer can draw it');
  });

  it('also takes a short formula', () => {
    const s = slideTitled(['معادلة الدائرة: x²+y²=r²', 'فكرة ثانية: شرح طويل لا يصلح أن يكون رقمًا'], 'معادلة الدائرة')!;
    assert.equal(s.layout, 'stat');
  });

  it('leaves a short plain word alone — display type would be a heading with nothing to say', () => {
    const s = slideTitled(['النوع: متغير', 'فكرة ثانية: شرح طويل لا يصلح أن يكون رقمًا'], 'النوع')!;
    assert.equal(s.layout, undefined);
    assert.equal(s.content, 'متغير');
  });

  it('leaves a long value alone even when it holds digits', () => {
    const s = slideTitled(['الشرط: يجب أن يكون المميز أكبر من 0 حتى يوجد حلان', 'فكرة ثانية: شرح طويل لا يصلح أن يكون رقمًا'], 'الشرط')!;
    assert.equal(s.layout, undefined);
  });
});
