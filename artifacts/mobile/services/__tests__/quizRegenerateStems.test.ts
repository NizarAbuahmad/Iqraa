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
 *
 * Re-measured 2026-10-15, counting a true/false statement offered with another
 * proposed answer as the same question (it is, to a teacher): the periodic-table
 * lesson holds 6 distinct medium questions, so a 5-question regenerate must
 * repeat at least 4 of them. The old count read those as new because the
 * proposed answer is re-rolled each time. That lesson now tests the notice; the
 * freshness tests use one whose bank can deliver a fresh paper (9 questions).
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

// The question, without the answer a true/false item proposes: the same statement
// offered with another proposed answer is the same question to the teacher.
/** A lesson with nine medium questions: room for two disjoint four-question papers. */
const freshReq = (extra: Partial<AIRequest> = {}) => quizReq({
  subject: 'الرياضيات',
  topic: 'الاشتقاق',
  lessonId: 'kbl-math-s2-nccd-u6_l2',
  numQuestions: 4,
  ...extra,
});

const stems = (q: QuizOutput) => q.questions.map(x => x.text.split('\n\nالإجابة المقترحة:')[0]!);
const shared = (a: QuizOutput, b: QuizOutput) => stems(b).filter(t => stems(a).includes(t)).length;

describe('quiz regenerate changes the questions', () => {
  it('no regeneration repeats more than one question of the one before, where the bank allows', async () => {
    let prev = await service.generateQuiz(freshReq());
    for (let i = 0; i < 30; i++) {
      const next = await service.generateQuiz(freshReq({ regenerate: true }));
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
    // Nine medium questions, four a paper: a wholly new paper is possible.
    const choice = freshReq;
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
