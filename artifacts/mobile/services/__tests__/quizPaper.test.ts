/**
 * The quiz as an exam paper — the document a teacher prints and hands out.
 *
 * Before this the printed quiz always carried its answer key, on the same
 * sheet as the questions, so the only way to print a student copy was to cut
 * the key off by hand. It also had nowhere for a student to write their name
 * and nowhere for the teacher to total the marks — the two things every
 * paper exam in a Jordanian classroom has, and the two things a teacher saw
 * missing the moment they compared it with a generic AI exam tool.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildQuizHTML, buildQuizSlidesHTML } from '../exportHtml.ts';
import { formatQuizText } from '../exportText.ts';
import { quizInstructions, quizMarkRows, quizMarksTotal, quizStudentFields } from '../quizPaper.ts';
import type { QuizOutput } from '../ai/AIService.ts';

const meta = { subject: 'الرياضيات', grade: 'الصف العاشر' };

const quiz = (): QuizOutput => ({
  duration: 20,
  totalPoints: 6,
  questions: [
    {
      id: 'q1', type: 'multiple_choice',
      text: 'أي مما يلي يمثل موردًا من موارد المشروع؟',
      options: ['أ) الوقت', 'ب) الجهد البشري', 'ج) المال', 'د) جميع ما سبق'],
      correctAnswer: 'د) جميع ما سبق', points: 2,
      explanation: 'كلها موارد',
    },
    {
      id: 'q2', type: 'true_false',
      text: 'الميزانية تساعد على ضبط الإنفاق.',
      options: ['صح', 'خطأ'], correctAnswer: 'صح', points: 2,
      explanation: '',
    },
    {
      id: 'q3', type: 'short_answer',
      text: 'ما المقصود بمتابعة المشروع؟',
      correctAnswer: 'مراقبة سير العمل وتصحيح الانحرافات', points: 2,
      explanation: '',
    },
  ],
}) as unknown as QuizOutput;

describe('quiz student copy', () => {
  it('drops the answer key from the printed paper when answers are excluded', () => {
    const html = buildQuizHTML(quiz(), 'اختبار', meta, true, [], false);
    assert.ok(!html.includes('مفتاح الإجابات'));
    assert.ok(!html.includes('class="answer-key"'));
    assert.ok(!html.includes('مراقبة سير العمل وتصحيح الانحرافات'), 'a short-answer key leaked onto the student copy');
  });

  it('keeps the key by default, so every existing caller is unaffected', () => {
    const html = buildQuizHTML(quiz(), 'اختبار', meta, true);
    assert.ok(html.includes('مفتاح الإجابات'));
  });

  it('puts the key on its own page, so the question pages print clean', () => {
    const html = buildQuizHTML(quiz(), 'اختبار', meta, true, [], true);
    assert.match(html, /<div class="key-page"><div class="answer-key">/);
  });

  it('drops the answer-key slide when answers are excluded, as the worksheet deck does', () => {
    assert.ok(!buildQuizSlidesHTML(quiz(), 'اختبار', meta, true, [], false).includes('مفتاح الإجابات'));
    assert.ok(buildQuizSlidesHTML(quiz(), 'اختبار', meta, true).includes('مفتاح الإجابات'));
  });

  // Isolating the whole keyed line «ب. x = 2» wrapped the letter's full stop
  // in with the maths («ب⁦. x = 2⁩»), so the key printed «ب x = 2 .».
  it('keeps a key letter and its full stop outside the maths isolate', () => {
    const q = quiz();
    q.questions[0]!.options = ['x = 1', 'x = 2'];
    q.questions[0]!.correctAnswer = 'x = 2';
    const html = buildQuizHTML(q, 'اختبار', meta, true, [], true);
    assert.ok(!html.includes('\u2066.'), 'a key letter\'s full stop went inside the isolate');
    assert.ok(html.includes('ب. \u2066x = 2\u2069'));
  });

  it('drops the key from the shared text when answers are excluded', () => {
    const text = formatQuizText(quiz(), 'اختبار', meta, true, false);
    assert.ok(!text.includes('مفتاح الإجابات'));
    assert.ok(!text.includes('كلها موارد'), 'an explanation leaked without the key header');
    assert.ok(formatQuizText(quiz(), 'اختبار', meta, true).includes('مفتاح الإجابات'));
  });
});

describe('exam paper parts', () => {
  it('gives the student somewhere to write their name, class and date', () => {
    assert.deepEqual(quizStudentFields(true), ['الاسم', 'الصف والشعبة', 'التاريخ']);
    assert.deepEqual(quizStudentFields(false), ['Name', 'Class', 'Date']);
  });

  it('only tells students to circle when the paper has options to circle', () => {
    const all = quizInstructions(quiz().questions, true);
    assert.ok(all.some(l => l.includes('ضع دائرة')));
    assert.ok(all.some(l => l.includes('المكان المخصص')));

    const shortOnly = quizInstructions([quiz().questions[2]!], true);
    assert.ok(!shortOnly.some(l => l.includes('ضع دائرة')), 'told students to circle on a paper with nothing to circle');
    assert.ok(shortOnly.some(l => l.includes('المكان المخصص')));

    const choiceOnly = quizInstructions([quiz().questions[0]!], false);
    assert.ok(!choiceOnly.some(l => /space provided/i.test(l)));
  });

  it('totals marks by question type, in the order the types first appear', () => {
    const [mc, , sa] = quiz().questions;
    const rows = quizMarkRows([mc!, sa!, { ...mc!, id: 'q4', points: 3 }], true);
    assert.deepEqual(rows, [
      { label: 'اختيار متعدد', count: 2, points: 5 },
      { label: 'إجابة قصيرة', count: 1, points: 2 },
    ]);
    assert.equal(quizMarksTotal(rows), 7);
  });

  it('reads a non-numeric points value as zero rather than printing NaN', () => {
    const odd = { ...quiz().questions[0]!, points: 'x' as unknown as number };
    assert.equal(quizMarksTotal(quizMarkRows([odd], true)), 0);
  });
});

describe('exam paper on the printed quiz', () => {
  for (const [copy, includeAnswers] of [['student', false], ['teacher', true]] as const) {
    it(`prints the student fields, instructions and marks table on the ${copy} copy`, () => {
      const html = buildQuizHTML(quiz(), 'اختبار', meta, true, [], includeAnswers);
      for (const field of quizStudentFields(true)) assert.ok(html.includes(field), `missing field ${field}`);
      assert.ok(html.includes('class="exam-fields"'));
      assert.ok(html.includes('أجب عن جميع الأسئلة'));
      assert.ok(html.includes('جدول العلامات'));
      assert.match(html, /class="marks-table"/);
      assert.match(html, /____ \/ 6</, 'the marks table did not print the paper total');
    });
  }

  it('prints the English labels on an English paper', () => {
    const html = buildQuizHTML(quiz(), 'Quiz', { subject: 'Math', grade: 'Grade 10' }, false, [], false);
    assert.ok(html.includes('Name') && html.includes('Marks'));
    assert.ok(!html.includes('الاسم'));
  });
});
