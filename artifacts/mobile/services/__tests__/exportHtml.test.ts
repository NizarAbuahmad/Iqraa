/**
 * The exported HTML documents — the ones that reach a teacher's printer.
 *
 * These could not exist until `exportHtml.ts` was split out of `share.ts`,
 * because `share.ts` imports `react-native` at module scope and `node:test`
 * cannot parse it. That gap is not theoretical: every Arabic PDF laid its
 * option letters out left-to-right, and lettered them A/B/C/D on an Arabic
 * paper, until a teacher printed one and noticed. Nothing in CI could see the
 * markup, so nothing complained.
 *
 * The first block below is the guard that would have caught it.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildActivityHTML,
  buildActivitySlidesHTML,
  buildLessonFlowHTML,
  buildLessonPlanHTML,
  buildLessonPlanSlidesHTML,
  buildQuizHTML,
  buildQuizSlidesHTML,
  buildWorksheetHTML,
  buildWorksheetSlidesHTML,
  EXPORT_FIGURE_MAX,
  type BookFigureRef,
} from '../exportHtml.ts';
import type {
  ActivityOutput,
  LessonFlowOutput,
  LessonPlanOutput,
  QuizOutput,
  WorksheetOutput,
} from '../ai/AIService.ts';

const meta = { subject: 'الرياضيات', grade: 'الصف العاشر' };

/** Options carry the marker a live model bakes in — the mock generator's don't. */
const quiz = (): QuizOutput => ({
  duration: 20,
  totalPoints: 6,
  questions: [
    {
      id: 'q1', type: 'multiple_choice',
      text: 'أي مما يلي يمثل موردًا من موارد المشروع؟',
      options: ['أ) الوقت', 'ب) الجهد البشري', 'ج) المال', 'د) جميع ما سبق'],
      correctAnswer: 'د) جميع ما سبق', points: 2,
    },
    {
      id: 'q2', type: 'true_false',
      text: 'الميزانية تساعد على ضبط الإنفاق.',
      options: ['صح', 'خطأ'], correctAnswer: 'صح', points: 2,
    },
    {
      id: 'q3', type: 'short_answer',
      text: 'ما المقصود بمتابعة المشروع؟',
      correctAnswer: 'مراقبة سير العمل وتصحيح الانحرافات', points: 2,
    },
  ],
}) as unknown as QuizOutput;

const worksheet = (): WorksheetOutput => ({
  instructions: 'أجب عن جميع الأسئلة.',
  sections: [{
    title: 'القسم الأول',
    questions: [{
      text: 'أي مما يلي صحيح؟',
      options: ['أ) الأول', 'ب) الثاني'],
      points: 2,
    }],
  }],
  answerKey: [{ num: 1, answer: 'الأول' }],
}) as unknown as WorksheetOutput;

const plan = (): LessonPlanOutput => ({
  objectives: ['هدف أول', 'هدف ثانٍ'],
  materials: ['سبورة'],
  introduction: 'تمهيد', mainActivity: 'نشاط', guidedPractice: 'تدريب موجّه',
  independentPractice: 'تدريب مستقل', closure: 'ختام', assessment: 'تقييم',
  differentiation: 'تمايز', homework: 'واجب',
}) as unknown as LessonPlanOutput;

const activity = (): ActivityOutput => ({
  title: 'نشاط صفي', activityType: 'quick-check',
  objective: 'هدف', groupSize: 'ثنائيات', totalDuration: 20,
  materials: ['ورق'],
  steps: [{ stepNumber: 1, title: 'خطوة', description: 'وصف', durationMin: 5 }],
  teacherTips: ['نصيحة'], differentiation: 'تمايز', assessment: 'تقييم',
}) as unknown as ActivityOutput;

const flow = (): LessonFlowOutput => ({
  topic: 'إدارة المشروع',
  grade: meta.grade,
  subject: meta.subject,
  duration: 45,
  objectives: ['هدف أول'],
  warmup: activity(),
  activity: activity(),
  guidedPractice: 'تدريب موجّه',
  worksheet: worksheet(),
  exitTicket: quiz(),
}) as unknown as LessonFlowOutput;

/** Every builder, rendered in Arabic — the RTL surface as a whole. */
const arabicDocuments = (): [string, string][] => [
  ['quiz', buildQuizHTML(quiz(), 'اختبار', meta, true)],
  ['worksheet', buildWorksheetHTML(worksheet(), 'ورقة عمل', meta, true)],
  ['lessonPlan', buildLessonPlanHTML(plan(), 'خطة', meta, true)],
  ['activity', buildActivityHTML(activity(), 'نشاط', meta, true)],
  ['quizSlides', buildQuizSlidesHTML(quiz(), 'اختبار', meta, true)],
  ['worksheetSlides', buildWorksheetSlidesHTML(worksheet(), 'ورقة عمل', meta, true)],
  ['lessonPlanSlides', buildLessonPlanSlidesHTML(plan(), 'خطة', meta, true)],
  ['activitySlides', buildActivitySlidesHTML(activity(), 'نشاط', meta, true)],
  ['lessonFlow', buildLessonFlowHTML(flow(), true)],
];

describe('RTL layout', () => {
  it('never re-reverses a row inside an already-RTL document', () => {
    // The bug, exactly: `<body>` sets direction:rtl, which already lays flex
    // items right-to-left. `row-reverse` on top of that reverses the reversal
    // and packs the row against the LEFT of a right-aligned page — which is
    // how option letters ended up on the wrong side of their own options.
    for (const [name, html] of arabicDocuments()) {
      assert.ok(
        !html.includes('row-reverse'),
        `${name} contains row-reverse — that cancels the document's own RTL direction`,
      );
    }
  });

  it('declares its direction on the document, not just per element', () => {
    // `dir` on the root is the invariant that matters: direction inherits, so
    // this alone makes the whole document RTL. The page builders also set
    // `direction` in body CSS and the slide builders do not — belt-and-braces
    // versus not, both correct. Asserting the CSS declaration would be testing
    // how it is written rather than what it does.
    for (const [name, html] of arabicDocuments()) {
      assert.match(html, /<html[^>]*dir="rtl"/, `${name} is missing dir="rtl" on <html>`);
    }
  });

  it('isolates an embedded equation in every Arabic document', () => {
    // Same failure the screens had, and worse on paper: an unisolated
    // «f(x) = 2x⁴ - x² + 3» comes out of the bidi algorithm reordered, and a
    // teacher hands that to a class with no way to reload and check. Every
    // builder must route its text through the isolating `esc`, so a new
    // builder that forgets it fails here rather than at a printer.
    const mathQuiz = quiz();
    mathQuiz.questions[0]!.text = 'اشتق الاقتران f(x) = 2x⁴ - x² + 3';
    const mathWorksheet = worksheet();
    mathWorksheet.sections[0]!.questions[0]!.text = 'اشتق الاقتران f(x) = 2x⁴ - x² + 3';

    const docs: [string, string][] = [
      ['quiz', buildQuizHTML(mathQuiz, 'اختبار', meta, true)],
      ['quizSlides', buildQuizSlidesHTML(mathQuiz, 'اختبار', meta, true)],
      ['worksheet', buildWorksheetHTML(mathWorksheet, 'ورقة عمل', meta, true)],
      ['worksheetSlides', buildWorksheetSlidesHTML(mathWorksheet, 'ورقة عمل', meta, true)],
    ];
    for (const [name, html] of docs) {
      assert.ok(
        html.includes('\u2066f(x) = 2x⁴ - x² + 3\u2069'),
        `${name} emitted the equation without directional isolates`,
      );
    }
  });

  it('leaves the English documents left-to-right', () => {
    const html = buildQuizHTML(quiz(), 'Quiz', { subject: 'Math', grade: 'Grade 10' }, false);
    assert.match(html, /dir="ltr"/);
    assert.ok(!html.includes('row-reverse'));
  });
});

describe('option lettering', () => {
  it('letters Arabic options in abjad order', () => {
    const html = buildQuizHTML(quiz(), 'اختبار', meta, true);
    for (const letter of ['أ.', 'ب.', 'ج.', 'د.']) {
      assert.ok(html.includes(letter), `expected option marker ${letter}`);
    }
  });

  it('never prints a latin marker on an Arabic paper', () => {
    const html = buildQuizHTML(quiz(), 'اختبار', meta, true);
    assert.ok(!/>A\.</.test(html), 'found a latin A. marker in Arabic output');
    assert.ok(!/>[A-D]\.</.test(html), 'found a latin option marker in Arabic output');
  });

  it('keeps A/B/C/D for English', () => {
    const html = buildQuizHTML(quiz(), 'Quiz', { subject: 'Math', grade: 'Grade 10' }, false);
    assert.ok(html.includes('A.') && html.includes('B.'));
  });

  it("strips the model's own marker instead of printing two", () => {
    // Live AI returns "أ) الوقت"; the mock returns "الوقت". Printing the
    // renderer's marker on top of the model's gave "أ. أ) الوقت" on paper.
    const html = buildQuizHTML(quiz(), 'اختبار', meta, true);
    assert.ok(!html.includes('أ) الوقت'), 'the model-supplied marker survived into the page');
    assert.ok(html.includes('الوقت'));
  });

  it('letters worksheet options the same way as quiz options', () => {
    const html = buildWorksheetHTML(worksheet(), 'ورقة عمل', meta, true);
    assert.ok(html.includes('أ.') && html.includes('ب.'));
    assert.ok(!/>[A-D]\.</.test(html));
  });
});

describe('answer key', () => {
  it('letters the key to match the printed option', () => {
    const html = buildQuizHTML(quiz(), 'اختبار', meta, true);
    // جميع ما سبق is the 4th option, so both paper and key must say (د).
    assert.ok(html.includes('د. جميع ما سبق'), 'answer key letter disagrees with the paper');
  });

  it('leaves a short-answer key as prose', () => {
    const html = buildQuizHTML(quiz(), 'اختبار', meta, true);
    assert.ok(html.includes('مراقبة سير العمل وتصحيح الانحرافات'));
  });
});

describe('document shape', () => {
  it('produces a complete document, not a fragment', () => {
    for (const [name, html] of arabicDocuments()) {
      assert.match(html, /<!DOCTYPE html>/i, `${name} is not a full document`);
      assert.match(html, /<\/html>/, `${name} is unterminated`);
    }
  });

  it('escapes content rather than interpolating it raw', () => {
    const hostile = quiz();
    hostile.questions[0]!.text = '<script>alert(1)</script>';
    const html = buildQuizHTML(hostile, 'اختبار', meta, true);
    assert.ok(!html.includes('<script>alert(1)</script>'), 'question text was not escaped');
    assert.ok(html.includes('&lt;script&gt;'));
  });
});


describe('printing without background graphics', () => {
  // Chrome's print dialog (and most browsers') defaults "Background graphics"
  // OFF. The four slide decks put white/near-white title text directly on a
  // colored gradient title-slide with no other fallback — without this
  // property, the gradient vanishes on print and the title, subject/grade
  // line and brand footer all disappear into an all-white page. `docx.docx`
  // isn't affected (a different writer entirely), only the browser-print /
  // "Save as PDF" path every one of these HTML builders feeds.
  it('forces backgrounds to print regardless of the browser\'s default', () => {
    for (const [name, html] of arabicDocuments()) {
      assert.match(
        html,
        /print-color-adjust:\s*exact/,
        `${name} has no print-color-adjust — a colored background can silently vanish on print`,
      );
    }
  });
});

describe('book figure appendix', () => {
  // A model never chose these — the whole point (see `figuresSectionHTML`'s
  // header comment). These are fixture URIs, not resolved assets; the actual
  // resolution (`bookFigureUri` + react-native) is out of reach for
  // `node:test`, same reason `bookFigureUri.ts` itself has no test file.
  const someFigures = (n: number): BookFigureRef[] =>
    Array.from({ length: n }, (_, i) => ({
      uri: `file:///figs/p0${i}.png`,
      page: 10 + i,
      caption: `كتاب الطالب · صفحة ${10 + i}`,
    }));

  it('adds nothing when no figures are passed — the default for every caller today', () => {
    // Every builder defaults `figures` to []. If a caller forgets to resolve
    // and pass them, the document must print exactly as it always has, not
    // silently gain an empty section.
    for (const [name, html] of arabicDocuments()) {
      assert.ok(!html.includes('من الكتاب المدرسي'), `${name} grew an appendix from nothing`);
    }
  });

  it('prints the appendix for all four document builders, cited by page', () => {
    const figs = someFigures(2);
    const builders: [string, (f: BookFigureRef[]) => string][] = [
      ['worksheet', f => buildWorksheetHTML(worksheet(), 'ورقة عمل', meta, true, f)],
      ['quiz', f => buildQuizHTML(quiz(), 'اختبار', meta, true, f)],
      ['lessonPlan', f => buildLessonPlanHTML(plan(), 'خطة', meta, true, f)],
      ['activity', f => buildActivityHTML(activity(), 'نشاط', meta, true, f)],
    ];
    for (const [name, build] of builders) {
      const html = build(figs);
      assert.ok(html.includes('من الكتاب المدرسي'), `${name} did not print the appendix heading`);
      assert.ok(html.includes('file:///figs/p00.png'), `${name} dropped the first figure's URI`);
      assert.ok(html.includes('صفحة 10'), `${name} dropped the page citation`);
    }
  });

  it('never attaches a figure to a specific question', () => {
    // The property that makes this safe without a vision model: the appendix
    // is a lesson-level block after the content, never interleaved with a
    // `.q-card`. A regex checking "no <img> before the last q-card" is the
    // structural version of that guarantee.
    const html = buildQuizHTML(quiz(), 'اختبار', meta, true, someFigures(1));
    const lastQuestion = html.lastIndexOf('q-card');
    const firstImage = html.indexOf('<img');
    assert.ok(firstImage > lastQuestion, 'a figure appeared before the questions, not after them');
  });

  it('caps at EXPORT_FIGURE_MAX rather than printing a whole lesson\'s figures', () => {
    const html = buildWorksheetHTML(worksheet(), 'ورقة عمل', meta, true, someFigures(EXPORT_FIGURE_MAX + 5));
    const shown = html.match(/<img /g)?.length ?? 0;
    assert.equal(shown, EXPORT_FIGURE_MAX);
  });

  it('escapes a hostile URI or caption', () => {
    const hostile: BookFigureRef[] = [{
      uri: '"><script>alert(1)</script>',
      page: 1,
      caption: '<script>alert(2)</script>',
    }];
    const html = buildQuizHTML(quiz(), 'اختبار', meta, true, hostile);
    assert.ok(!html.includes('<script>alert(1)</script>'));
    assert.ok(!html.includes('<script>alert(2)</script>'));
  });

  it('says the note in the requested language', () => {
    const ar = buildQuizHTML(quiz(), 'اختبار', meta, true, someFigures(1));
    const en = buildQuizHTML(quiz(), 'Quiz', meta, false, someFigures(1));
    assert.ok(ar.includes('من الكتاب المدرسي'));
    assert.ok(en.includes('From the Student Book'));
  });
});

/**
 * The projected worksheet carries the same figures the printed one does.
 *
 * These four builders took no figures argument at all —
 * `buildWorksheetSlidesHTML` was even commented "Text only in this builder" —
 * while their print-path twins ended with the «من الكتاب المدرسي» appendix.
 * So the same worksheet, from the same screen, showed the book's diagrams on
 * paper and none on the projector, with nothing to say why. The two call
 * sites sit seven lines apart in `useGeneratorExport.ts`.
 */
describe('book figures on the projector builders', () => {
  const imgs = (h: string) => (h.match(/<img /g) ?? []).length;
  // `class="slide title-slide"` is a slide too — matching only `slide"`
  // undercounts by exactly the title slide, which reads as an off-by-one in
  // the footer rather than as a miscount here.
  const slideCount = (h: string) => (h.match(/class="slide[ "]/g) ?? []).length;
  const figures = (n: number): BookFigureRef[] =>
    Array.from({ length: n }, (_, i) => ({
      uri: `file:///figs/p0${i}.png`,
      page: 21 + i,
      caption: `كتاب الطالب · صفحة ${21 + i}`,
    }));

  const builders: [string, (f?: BookFigureRef[]) => string][] = [
    ['worksheet', f => buildWorksheetSlidesHTML(worksheet(), 'ورقة', meta, true, f)],
    ['quiz', f => buildQuizSlidesHTML(quiz(), 'اختبار', meta, true, f)],
    ['lesson plan', f => buildLessonPlanSlidesHTML(plan(), 'خطة', meta, true, f)],
    ['activity', f => buildActivitySlidesHTML(activity(), 'نشاط', meta, true, f)],
  ];

  for (const [name, build] of builders) {
    it(`${name}: renders them and adds exactly one slide, not one per figure`, () => {
      const without = build();
      const withFigs = build(figures(2));
      assert.equal(imgs(without), 0, 'no figures passed, none rendered');
      assert.equal(imgs(withFigs), 2);
      assert.equal(slideCount(withFigs), slideCount(without) + 1);
      assert.match(withFigs, /من الكتاب المدرسي/);
      // The page citation has to survive into the markup, not only the alt.
      assert.match(withFigs, /صفحة ٢١|صفحة 21/);
    });

    it(`${name}: counts the extra slide in the footer total`, () => {
      // A footer reading "5 / 4" is how a teacher learns not to trust the deck.
      const html = build(figures(2));
      const totals = [...html.matchAll(/(\d+) \/ (\d+)</g)].map(m => Number(m[2]));
      assert.ok(totals.length > 0, 'the deck numbers its slides');
      assert.ok(
        totals.every(t => t === slideCount(html)),
        `footer total ${totals[0]} should equal ${slideCount(html)} rendered slides`,
      );
    });
  }

  it('caps at EXPORT_FIGURE_MAX, like the printed appendix', () => {
    const html = buildWorksheetSlidesHTML(
      worksheet(), 'ورقة', meta, true, figures(EXPORT_FIGURE_MAX + 4),
    );
    assert.equal(imgs(html), EXPORT_FIGURE_MAX);
  });

  it('gives the lesson-flow PDF the appendix too', () => {
    // The one document that bundles a worksheet and an exit ticket together,
    // and so the one where the missing appendix was least obvious.
    const withFigs = buildLessonFlowHTML(flow(), true, figures(2));
    assert.equal(imgs(withFigs), 2);
    assert.equal(imgs(buildLessonFlowHTML(flow(), true)), 0);
  });
});
