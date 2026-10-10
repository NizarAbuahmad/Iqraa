/**
 * An exam is a ministry paper: question types in blocks, in a fixed order,
 * each under its «السؤال الأول: …» direction. The offline generator used to
 * cycle the types (MCQ, T/F, short, MCQ, T/F, …) and every export printed one
 * flat list.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as docx from 'docx';

import { aiService, questionBankPolicy } from '../ai/generators.ts';
import { buildQuizHTML } from '../exportHtml.ts';
import { formatQuizText } from '../exportText.ts';
import { buildQuizDocx } from '../quizDocx.ts';
import { quizBlocks, QUIZ_TYPE_ORDER } from '../quizPaper.ts';
import type { AIRequest, QuizOutput } from '../ai/AIService.ts';
import { documentXmlOf } from './docxXml.ts';

// A subject with no concrete bank, so the template path runs (see
// questionDifficulty.test.ts for why this is lifted per file).
before(() => { questionBankPolicy.required = false; });
after(() => { questionBankPolicy.required = true; });

const REQ = {
  grade: 'الصف العاشر', subject: 'الأحياء', topic: 'الخلية ووظائفها',
  language: 'arabic', totalMarks: 20, duration: 20, difficulty: 'medium',
} as AIRequest;

const meta = { subject: 'الأحياء', grade: 'الصف العاشر' };

const paper = (): QuizOutput => ({
  duration: 20, totalPoints: 8,
  questions: [
    { id: 'q1', type: 'multiple_choice', text: 'أيّ؟', options: ['أ', 'ب', 'ج'], correctAnswer: 'ب', points: 2, explanation: '' },
    { id: 'q2', type: 'multiple_choice', text: 'أيّ آخر؟', options: ['أ', 'ب', 'ج'], correctAnswer: 'أ', points: 2, explanation: '' },
    { id: 'q3', type: 'true_false', text: 'الماء مركّب.', options: ['صح', 'خطأ'], correctAnswer: 'صح', points: 2, explanation: '' },
    { id: 'q4', type: 'fill_blank', text: 'تنشأ الرابطة الأيونية بين __________ و__________.', correctAnswer: 'فلز؛ لافلز', points: 2, explanation: '' },
  ],
}) as unknown as QuizOutput;

describe('offline quiz generator', () => {
  it('emits one consecutive block per ticked type, in ministry order', async () => {
    const quiz = await aiService.generateQuiz({
      ...REQ, numQuestions: 9,
      questionTypes: ['short_answer', 'true_false', 'multiple_choice'],
    });
    const types = quiz.questions.map(q => q.type);
    const order = QUIZ_TYPE_ORDER.filter(t => types.includes(t));
    assert.deepEqual(order, ['multiple_choice', 'true_false', 'short_answer']);
    const runs = types.filter((t, i) => t !== types[i - 1]);
    assert.deepEqual(runs, order, `types are interleaved: ${types.join(',')}`);
  });

  it('splits the count evenly, earlier blocks taking the remainder', async () => {
    const quiz = await aiService.generateQuiz({
      ...REQ, numQuestions: 8, questionTypes: ['multiple_choice', 'true_false', 'short_answer'],
    });
    const count = (t: string) => quiz.questions.filter(q => q.type === t).length;
    assert.deepEqual([count('multiple_choice'), count('true_false'), count('short_answer')], [3, 3, 2]);
  });

  it('builds fill-in-the-blank questions with blanks and no options', async () => {
    const quiz = await aiService.generateQuiz({ ...REQ, numQuestions: 4, questionTypes: ['fill_blank'] });
    assert.ok(quiz.questions.length > 0);
    for (const q of quiz.questions) {
      assert.equal(q.type, 'fill_blank');
      assert.equal(q.options, undefined);
    }
  });

  it('honours a true/false-only request: nothing else comes back', async () => {
    const quiz = await aiService.generateQuiz({ ...REQ, numQuestions: 6, questionTypes: ['true_false'] });
    assert.ok(quiz.questions.every(q => q.type === 'true_false' && q.options?.length === 2));
  });
});

describe('the printed exam paper', () => {
  it('has one heading per block, numbered السؤال الأول، الثاني…', () => {
    const blocks = quizBlocks(paper().questions, true);
    assert.deepEqual(blocks.map(b => b.type), ['multiple_choice', 'true_false', 'fill_blank']);
    assert.match(blocks[0]!.heading, /^السؤال الأول: /);
    assert.match(blocks[1]!.heading, /^السؤال الثاني: .*✓/);
    assert.match(blocks[2]!.heading, /^السؤال الثالث: أكمل/);
    assert.deepEqual(blocks.map(b => b.start), [0, 2, 3]);
  });

  it('does not merge two runs of one type that are not adjacent', () => {
    const q = paper().questions;
    assert.equal(quizBlocks([q[0]!, q[2]!, q[1]!], true).length, 3);
  });

  it('prints the headings on the PDF, the text and the Word file', async () => {
    const html = buildQuizHTML(paper(), 'اختبار', meta, true);
    const text = formatQuizText(paper(), 'اختبار', meta, true);
    const word = documentXmlOf(await docx.Packer.toBuffer(buildQuizDocx(paper(), 'اختبار', meta, true, false, docx)));
    for (const [name, body] of [['html', html], ['text', text], ['word', word]] as const) {
      assert.ok(body.includes('السؤال الأول'), `${name}: no first heading`);
      assert.ok(body.includes('السؤال الثالث'), `${name}: no third heading`);
    }
  });

  it('numbers the questions straight through, whatever the blocks', () => {
    const html = buildQuizHTML(paper(), 'اختبار', meta, true);
    for (const n of [1, 2, 3, 4]) assert.ok(html.includes(`<span class="q-num">${n}</span>`), `missing number ${n}`);
  });

  it('gives a fill-blank no ruled writing lines, and labels it', () => {
    const html = buildQuizHTML({ ...paper(), questions: [paper().questions[3]!] }, 'اختبار', meta, true);
    assert.ok(!html.includes('class="q-lines"'));
    assert.ok(html.includes('أكمل الفراغ'));
  });
});
