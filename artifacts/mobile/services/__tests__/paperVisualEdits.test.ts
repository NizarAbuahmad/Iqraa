import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyOptionEdit, applyQuestionEdit } from '../quizEdits.ts';
import {
  applyWorksheetAnswerEdit, applyWorksheetFigure, applyWorksheetOptionEdit, applyWorksheetQuestionEdit,
} from '../worksheetEdits.ts';
import type { QuizOutput, QuizQuestion, WorksheetOutput } from '../ai/AIService.ts';

const PROJ = { kind: 'projectile', launch: 'ground', angle: 30, speed: { n: 20, unit: 'm/s' }, marks: ['v0', 'H', 'R'] } as unknown as QuizQuestion['visual'];
const STEM = 'قُذفت كرة بسرعة 20 م/ث بزاوية 30° مع الأفق. احسب أقصى ارتفاع.';

const quizQ = (): QuizQuestion => ({
  id: 'q1', type: 'multiple_choice', text: STEM, options: ['5 m', '10 m', '20 m', '40 m'], correctAnswer: '5 m',
  points: 2, explanation: 'H = v²sin²θ/2g', visual: PROJ,
});
const quiz = (): QuizOutput => ({ title: 't', duration: 20, totalPoints: 2, questions: [quizQ()] });
const ws = (): WorksheetOutput => ({
  title: 't', instructions: 'i',
  sections: [{ type: 'multiple_choice', title: 's', questions: [{ text: STEM, options: ['5 m', '10 m'], points: 2, visual: PROJ }] }],
  answerKey: [{ num: 1, answer: '5 m' }],
});

describe('a quiz edit and the drawing', () => {
  it('a new text drops it', () => assert.ok(!('visual' in applyQuestionEdit(quiz(), 0, { text: 'x' }).questions[0]!)));
  it('a new answer drops it', () => assert.ok(!('visual' in applyQuestionEdit(quiz(), 0, { correctAnswer: '10 m' }).questions[0]!)));
  it('points or explanation keep it', () => {
    assert.ok(applyQuestionEdit(quiz(), 0, { points: 3 }).questions[0]!.visual);
    assert.ok(applyQuestionEdit(quiz(), 0, { explanation: 'y' }).questions[0]!.visual);
  });
  it('rewriting the correct option drops it; another option keeps it', () => {
    assert.ok(!('visual' in applyOptionEdit(quizQ(), 0, '6 m')));
    assert.ok(applyOptionEdit(quizQ(), 1, '11 m').visual);
  });
});

describe('a worksheet edit and the drawing', () => {
  const q0 = (w: WorksheetOutput) => w.sections[0]!.questions[0]!;
  it('a new text drops it', () => assert.ok(!('visual' in q0(applyWorksheetQuestionEdit(ws(), 0, 0, { text: 'x' })))));
  it('points keep it', () => assert.ok(q0(applyWorksheetQuestionEdit(ws(), 0, 0, { points: 3 })).visual));
  it('a new answer drops it', () => assert.ok(!('visual' in q0(applyWorksheetAnswerEdit(ws(), 0, 0, '10 m')))));
  it('rewriting the correct option drops it; another option keeps it', () => {
    assert.ok(!('visual' in q0(applyWorksheetOptionEdit(ws(), 0, 0, 0, '6 m'))));
    assert.ok(q0(applyWorksheetOptionEdit(ws(), 0, 0, 1, '11 m')).visual);
  });
  it('attaching a book figure keeps it', () => {
    const fig = { uri: 'https://x/p1.png', page: 1, caption: 'c' };
    assert.ok(q0(applyWorksheetFigure(ws(), 0, 0, fig)).visual);
  });
});
