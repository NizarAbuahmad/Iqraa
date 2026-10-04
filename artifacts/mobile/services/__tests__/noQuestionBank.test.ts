/**
 * The offline generator has question banks for maths and chemistry only. For
 * any other subject the question-based generators refuse with a typed error
 * instead of returning topic-templated filler («الوصف الصحيح لـX»).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MockAIService, NoQuestionBankError } from '../ai/generators.ts';
import { aiErrorMessageKey } from '../ai/aiProvenance.ts';
import translations from '../i18n.ts';
import type { AIRequest } from '../ai/AIService.ts';

const service = new MockAIService();
(service as unknown as { delay: () => Promise<void> }).delay = async () => {};

const BASE = { language: 'arabic', difficulty: 'mixed', numQuestions: 6 } as const;
const ISLAMIC = { ...BASE, grade: 'الصف الأول', subject: 'التربية الإسلامية', topic: 'سورة الإخلاص' } as AIRequest;
const MATHS = { ...BASE, grade: 'الصف العاشر', subject: 'الرياضيات', topic: 'المعادلات الأسية' } as AIRequest;
const CHEM = { ...BASE, grade: 'الصف العاشر', subject: 'Chemistry', topic: 'المول والكتلة المولية' } as AIRequest;

const refuses = (e: unknown) => e instanceof NoQuestionBankError && e.code === 'no_question_bank';

describe('subjects with no question bank', () => {
  it('refuses a worksheet, a quiz and homework', async () => {
    await assert.rejects(service.generateWorksheet(ISLAMIC), refuses);
    await assert.rejects(service.generateQuiz(ISLAMIC), refuses);
    await assert.rejects(service.generateHomework(ISLAMIC), refuses);
  });

  it('still serves maths and chemistry', async () => {
    for (const req of [MATHS, CHEM]) {
      assert.ok((await service.generateQuiz(req)).questions.length > 0);
      assert.ok((await service.generateWorksheet(req)).sections.length > 0);
      assert.ok((await service.generateHomework(req)).sections.length > 0);
    }
  });

  it('still writes a lesson plan for any subject', async () => {
    assert.ok((await service.generateLessonPlan(ISLAMIC)).objectives.length > 0);
  });

  it('maps to its own message in both languages, not «try again»', () => {
    const key = aiErrorMessageKey(new NoQuestionBankError('x'));
    assert.equal(key, 'noQuestionBank');
    assert.ok((translations as any).ar[key] && (translations as any).en[key]);
  });
});
