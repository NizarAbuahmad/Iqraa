/**
 * Which generated questions came from the reviewed bank.
 *
 * The screens used to say «الإجابات من بنك الأسئلة المُراجَع» under any answer
 * the verifier had not proved, including a history worksheet the live model
 * wrote, because there was no way to tell a bank item from anything else.
 * `fromBank` is that way: set where an item is drawn from the bank, and
 * nowhere else. Anything unmarked reads as "nobody reviewed this", so a path
 * that forgets to mark fails toward under-claiming.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MockAIService } from '../ai/generators.ts';
import type { AIRequest } from '../ai/AIService.ts';

const service = new MockAIService();
(service as unknown as { delay: () => Promise<void> }).delay = async () => {};

const BASE = { language: 'arabic', difficulty: 'mixed', numQuestions: 8 } as const;
const MATHS = { ...BASE, grade: 'الصف العاشر', subject: 'الرياضيات', topic: 'المعادلات الأسية' } as AIRequest;
const CHEM = { ...BASE, grade: 'الصف العاشر', subject: 'Chemistry', topic: 'المول والكتلة المولية' } as AIRequest;

describe('bank items are marked fromBank', () => {
  for (const req of [MATHS, CHEM]) {
    it(`every ${req.subject} quiz question`, async () => {
      const quiz = await service.generateQuiz(req);
      assert.ok(quiz.questions.length > 0);
      for (const q of quiz.questions) assert.equal(q.fromBank, true, q.text);
    });

    it(`every ${req.subject} worksheet question`, async () => {
      const sheet = await service.generateWorksheet(req);
      const qs = sheet.sections.flatMap(s => s.questions);
      assert.ok(qs.length > 0);
      for (const q of qs) assert.equal(q.fromBank, true, q.text);
    });
  }

  it('not a prior-review question, which is written from a template', async () => {
    const sheet = await service.generateWorksheet({
      ...MATHS,
      includePriorReview: true,
      priorKnowledge: ['الأسس', 'اللوغاريتمات'],
    } as AIRequest);
    const review = sheet.sections.find(s => s.title === 'مراجعة سابقة');
    assert.ok(review, 'no prior-review section');
    for (const q of review!.questions) assert.equal(q.fromBank, undefined, q.text);
  });
});
