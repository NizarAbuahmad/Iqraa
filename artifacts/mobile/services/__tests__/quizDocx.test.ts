/**
 * The quiz as an editable Word exam. It used to be the plain-text share run
 * through the generic text-to-Word converter: no lines for the student's
 * name, no marks table, the answer key always included, and nothing a teacher
 * could hand out without first rebuilding it by hand in Word.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as docx from 'docx';

import { buildQuizDocx } from '../quizDocx.ts';
import type { QuizOutput } from '../ai/AIService.ts';
import { documentXmlOf } from './docxXml.ts';

const meta = { subject: 'الرياضيات', grade: 'الصف العاشر' };

const quiz = (): QuizOutput => ({
  duration: 20,
  totalPoints: 6,
  questions: [
    {
      id: 'q1', type: 'multiple_choice',
      text: 'أي مما يلي يمثل موردًا من موارد المشروع؟',
      options: ['أ) الوقت', 'ب) الجهد البشري', 'ج) المال', 'د) جميع ما سبق'],
      correctAnswer: 'د) جميع ما سبق', points: 2, explanation: 'كلها موارد',
    },
    {
      id: 'q2', type: 'true_false', text: 'الميزانية تساعد على ضبط الإنفاق.',
      options: ['صح', 'خطأ'], correctAnswer: 'صح', points: 2, explanation: '',
    },
    {
      id: 'q3', type: 'short_answer', text: 'ما المقصود بمتابعة المشروع؟',
      correctAnswer: 'مراقبة سير العمل وتصحيح الانحرافات', points: 2, explanation: '',
    },
  ],
}) as unknown as QuizOutput;

async function xmlOf(q: QuizOutput, isAr: boolean, includeAnswers: boolean): Promise<string> {
  const m = isAr ? meta : { subject: 'Math', grade: 'Grade 10' };
  return documentXmlOf(await docx.Packer.toBuffer(buildQuizDocx(q, isAr ? 'اختبار' : 'Quiz', m, isAr, includeAnswers, docx)));
}

describe('buildQuizDocx', () => {
  it('prints the exam head, every question and its lettered options', async () => {
    const xml = await xmlOf(quiz(), true, false);
    for (const s of [
      'اختبار', 'الاسم', 'الصف والشعبة', 'التاريخ', 'أجب عن جميع الأسئلة', 'جدول العلامات',
      'أي مما يلي يمثل موردًا من موارد المشروع؟', 'ما المقصود بمتابعة المشروع؟', 'د. جميع ما سبق', '____ / 6',
    ]) assert.ok(xml.includes(s), `missing ${s}`);
  });

  it('leaves the answer key off the student copy', async () => {
    const xml = await xmlOf(quiz(), true, false);
    assert.ok(!xml.includes('مفتاح الإجابات'));
    assert.ok(!xml.includes('مراقبة سير العمل وتصحيح الانحرافات'));
    assert.ok(!xml.includes('كلها موارد'));
  });

  it('starts the teacher copy key on a new page, with the explanations', async () => {
    const xml = await xmlOf(quiz(), true, true);
    const key = xml.indexOf('مفتاح الإجابات');
    assert.ok(key > 0);
    const keyPara = xml.slice(xml.lastIndexOf('<w:p>', key), key);
    assert.ok(keyPara.includes('<w:pageBreakBefore/>'), 'the key is not on its own page');
    assert.ok(xml.includes('كلها موارد'));
    assert.ok(xml.includes('مراقبة سير العمل وتصحيح الانحرافات'));
  });

  it('lays every Arabic paragraph and table out right-to-left', async () => {
    const xml = await xmlOf(quiz(), true, true);
    const paras = xml.match(/<w:p>[\s\S]*?<\/w:p>|<w:p [\s\S]*?<\/w:p>/g) ?? [];
    assert.ok(paras.length > 10);
    for (const p of paras) assert.ok(p.includes('<w:bidi/>'), `paragraph without bidi: ${p.slice(0, 160)}`);
    assert.ok(xml.includes('<w:bidiVisual/>'), 'the marks table reads left-to-right');
  });

  // `isolateForeignRuns` on a whole «أ. x = 1» line wraps «. x = 1» — the
  // letter's full stop included — and Word then prints «أ x = 1 .». The
  // letter and the option text are isolated apart, as the printed page does.
  it('keeps the option letter and its full stop outside the maths isolate', async () => {
    const q = quiz();
    q.questions[0]!.options = ['x = 1', 'x = 2'];
    q.questions[0]!.correctAnswer = 'x = 2';
    const xml = await xmlOf(q, true, true);
    assert.ok(!xml.includes('\u2066.'), 'an option letter\'s full stop went inside the isolate');
    assert.ok(xml.includes('أ. \u2066x = 1\u2069'));
    assert.ok(xml.includes('ب. \u2066x = 2\u2069'), 'the key line isolates differently from the option');
  });

  it('leaves an English paper left-to-right', async () => {
    const xml = await xmlOf(quiz(), false, false);
    assert.ok(xml.includes('Name') && xml.includes('Answer all questions.'));
    assert.ok(!xml.includes('<w:bidi/>'));
    assert.ok(!xml.includes('<w:bidiVisual/>'));
  });
});
