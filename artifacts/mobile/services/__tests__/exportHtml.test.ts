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
