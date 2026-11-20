import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as docx from 'docx';
import { buildQuizDocx } from '../quizDocx.ts';
import { formatQuizText, formatWorksheetText } from '../exportText.ts';
import type { QuizOutput, QuizQuestion, WorksheetOutput } from '../ai/AIService.ts';
import { documentXmlOf } from './docxXml.ts';

const PROJ = { kind: 'projectile', launch: 'ground', angle: 30, speed: { n: 20, unit: 'm/s' }, marks: ['v0', 'H', 'R'] } as unknown as QuizQuestion['visual'];
const STEM = 'قُذفت كرة بسرعة 20 م/ث بزاوية 30° مع الأفق. احسب أقصى ارتفاع.';
const STEM_NO_SPEED = 'قُذفت كرة بزاوية 30° مع الأفق. احسب سرعتها الابتدائية.';
const meta = { subject: 'الفيزياء', grade: 'الصف العاشر' };
const quiz = (text: string): QuizOutput => ({ title: 't', duration: 20, totalPoints: 2, questions: [{ id: 'a', type: 'short_answer', text, correctAnswer: 'a', points: 2, explanation: '', visual: PROJ }] }) as unknown as QuizOutput;
const sheet = (text: string): WorksheetOutput => ({ title: 't', instructions: 'i', sections: [{ type: 'short_answer', title: 's', questions: [{ text, points: 2, visual: PROJ }] }], answerKey: [{ num: 1, answer: 'a' }] }) as unknown as WorksheetOutput;

describe('the text copies name the drawing', () => {
  it('quiz text: the note under a drawn question, and none when the drawing is not shown', () => {
    assert.ok(formatQuizText(quiz(STEM), 't', meta, true).includes('(الرسم في نسخة PDF)'));
    assert.ok(formatQuizText(quiz(STEM), 't', meta, false).includes('(The drawing is in the PDF.)'));
    assert.ok(!formatQuizText(quiz(STEM_NO_SPEED), 't', meta, true).includes('(الرسم في نسخة PDF)'));
  });
  it('worksheet text, the same', () => {
    assert.ok(formatWorksheetText(sheet(STEM), 't', meta, true).includes('(الرسم في نسخة PDF)'));
    assert.ok(!formatWorksheetText(sheet(STEM_NO_SPEED), 't', meta, true).includes('(الرسم في نسخة PDF)'));
  });
  it('quiz Word file carries the note', async () => {
    const xml = documentXmlOf(await docx.Packer.toBuffer(buildQuizDocx(quiz(STEM), 't', meta, true, false, docx)));
    assert.ok(xml.includes('(الرسم في نسخة PDF)'));
    const plain = documentXmlOf(await docx.Packer.toBuffer(buildQuizDocx(quiz(STEM_NO_SPEED), 't', meta, true, false, docx)));
    assert.ok(!plain.includes('(الرسم في نسخة PDF)'));
  });
});
