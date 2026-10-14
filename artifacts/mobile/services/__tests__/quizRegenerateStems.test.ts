/**
 * «أعد التجهيز» on a quiz must change the QUESTIONS, not just the paper.
 *
 * `freshOnRegenerate` used to compare the whole quiz JSON with the last one. A
 * paper with the same stems in another order — or with the options shuffled —
 * counted as fresh, so on a lesson with a small bank (the periodic-table
 * lesson holds about ten questions) a teacher pressed regenerate and saw the
 * same questions: measured over 30 regenerations, 2.4 of 5 stems repeated on
 * average and 3 papers repeated all five.
 *
 * Regenerate now prefers the draw that shares the fewest stems with what is on
 * screen, and when the bank cannot avoid a repeat the paper says so
 * (`repeated`) rather than passing it off as new.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MockAIService } from '../ai/generators.ts';
import type { AIRequest, QuizOutput } from '../ai/AIService.ts';

const service = new MockAIService();
(service as unknown as { delay: () => Promise<void> }).delay = async () => {};

const quizReq = (extra: Partial<AIRequest> = {}) => ({
  grade: 'الصف العاشر',
  subject: 'Chemistry',
  topic: 'الجدول الدوري وخواص العناصر',
  lessonId: 'kbl-chem-2-1',
  language: 'arabic',
  duration: 20,
  totalMarks: 20,
  numQuestions: 5,
  difficulty: 'medium',
  questionTypes: ['multiple_choice', 'true_false', 'short_answer'],
  ...extra,
}) as AIRequest;

const stems = (q: QuizOutput) => q.questions.map(x => x.text);
const shared = (a: QuizOutput, b: QuizOutput) => stems(b).filter(t => stems(a).includes(t)).length;

describe('quiz regenerate changes the questions', () => {
  it('a small-bank lesson: no regeneration repeats more than one question of the one before', async () => {
    let prev = await service.generateQuiz(quizReq());
    for (let i = 0; i < 30; i++) {
      const next = await service.generateQuiz(quizReq({ regenerate: true }));
      assert.ok(shared(prev, next) <= 1, `regeneration ${i + 1} repeated ${shared(prev, next)} of ${next.questions.length} questions`);
      prev = next;
    }
  });

  it('never trades the paper size for freshness', async () => {
    await service.generateQuiz(quizReq());
    for (let i = 0; i < 10; i++) {
      const next = await service.generateQuiz(quizReq({ regenerate: true }));
      assert.equal(next.questions.length, 5);
    }
  });

  it('says so when it could not avoid repeating, and counts exactly', async () => {
    // Ask for everything the bank has, so nothing new can be offered.
    const all = (extra: Partial<AIRequest> = {}) => quizReq({ numQuestions: 20, ...extra });
    const first = await service.generateQuiz(all());
    const again = await service.generateQuiz(all({ regenerate: true }));
    assert.equal(again.repeated?.of, again.questions.length);
    assert.equal(again.repeated?.count, shared(first, again));
    assert.ok((again.repeated?.count ?? 0) > 0, 'a spent bank must be reported, not hidden');
  });

  it('a first generation, and a regenerate that changed every question, carry no notice', async () => {
    // Choice questions only: this lesson holds a single medium short-answer
    // question, so a paper that includes one can never be wholly new.
    const choice = (extra: Partial<AIRequest> = {}) =>
      quizReq({ numQuestions: 4, questionTypes: ['multiple_choice', 'true_false'], ...extra });
    const first = await service.generateQuiz(choice());
    assert.equal(first.repeated, undefined);
    let prev = first;
    let clean = 0;
    for (let i = 0; i < 30; i++) {
      const next = await service.generateQuiz(choice({ regenerate: true }));
      if (shared(prev, next) === 0) {
        assert.equal(next.repeated, undefined);
        clean++;
      }
      prev = next;
    }
    assert.ok(clean > 0, 'expected at least one fully fresh paper in 30 regenerations');
  });
});
