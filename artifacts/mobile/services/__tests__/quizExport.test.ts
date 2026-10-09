/**
 * A quiz exported from موادي or from the chat. Neither screen has the quiz
 * screen's answers toggle, so both exported the teacher's copy — key included,
 * plain-text Word — however the quiz was meant to be used. `quizExports` is
 * what both now call, with the copy the teacher picked in the export menu.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as docx from 'docx';

import { quizExports } from '../quizExport.ts';
import type { QuizOutput } from '../ai/AIService.ts';
import { documentXmlOf } from './docxXml.ts';

const meta = { subject: 'الرياضيات', grade: 'الصف العاشر' };

const quiz = (): QuizOutput => ({
  duration: 20,
  totalPoints: 4,
  questions: [
    {
      id: 'q1', type: 'multiple_choice', text: 'أي مما يلي صحيح؟',
      options: ['أ) الأول', 'ب) الثاني'], correctAnswer: 'ب) الثاني', points: 2, explanation: 'لأنه الثاني',
    },
    {
      id: 'q2', type: 'short_answer', text: 'عرّف المشروع.',
      correctAnswer: 'جهد مؤقت لتحقيق هدف', points: 2, explanation: '',
    },
  ],
}) as unknown as QuizOutput;

const KEY = ['مفتاح الإجابات', 'جهد مؤقت لتحقيق هدف', 'لأنه الثاني'];

async function all(copy: 'student' | 'teacher') {
  const out = quizExports(quiz(), 'اختبار', meta, true, copy);
  const word = documentXmlOf(await docx.Packer.toBuffer(out.word(docx)));
  return { text: out.text, html: out.html, word };
}

describe('quizExports', () => {
  it('leaves the key out of every format of the student copy', async () => {
    const docs = await all('student');
    for (const [format, body] of Object.entries(docs)) {
      for (const k of KEY) assert.ok(!body.includes(k), `${format} student copy carries «${k}»`);
    }
  });

  it('puts the key in every format of the teacher copy', async () => {
    const docs = await all('teacher');
    for (const [format, body] of Object.entries(docs)) {
      assert.ok(body.includes('مفتاح الإجابات'), `${format} teacher copy has no key`);
    }
  });

  it('prints the exam head on both copies, in the PDF and the Word file', async () => {
    for (const copy of ['student', 'teacher'] as const) {
      const { html, word } = await all(copy);
      for (const body of [html, word]) {
        assert.ok(body.includes('الصف والشعبة') && body.includes('جدول العلامات'), `${copy} copy has no exam head`);
      }
    }
  });
});
