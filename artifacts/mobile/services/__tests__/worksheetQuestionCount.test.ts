/**
 * The question-count picker has to be honoured, not clamped.
 *
 * `app/ai-tools/worksheet.tsx` offers 5, 8, 10, 12, 15 and 20 questions. The
 * offline generator forced the number into 6–12, so a teacher asking for 5 got
 * 6 and one asking for 15 or 20 got 12 — silently, and differently from the
 * live path, whose prompt carries the number as asked. `lessonFlowRunner`
 * asks for 5 and was getting 6 for the same reason.
 *
 * The lesson here is exponential equations because its bank is deep enough
 * (17 items) to supply 15 questions. A shallow bank (قانون الجيوب holds 3,
 * المشتقات holds 5) legitimately returns fewer than asked — the generator stays
 * short rather than padding with templates — and that is a different, deliberate
 * limit this file does not pin.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aiService } from '@/services/ai/generators.ts';
import type { AIRequest } from '@/services/ai/AIService.ts';

const LESSON = { topic: 'المعادلات الأسية', subject: 'الرياضيات', grade: 'الصف العاشر' };

async function countFor(numQuestions: number, withWordProblem = false): Promise<number> {
  const out = await aiService.generateWorksheet({
    ...LESSON, language: 'arabic', difficulty: 'medium', numQuestions,
    questionTypes: withWordProblem
      ? ['multiple_choice', 'short_answer', 'word_problem']
      : ['multiple_choice', 'short_answer'],
  } as AIRequest);
  // The worked example is not a question but it is one of the n asked for.
  return out.sections.reduce((n, s) => n + s.questions.length, 0) + (out.workedExample ? 1 : 0);
}

describe('worksheet question count', () => {
  it('gives exactly 5 when 5 is asked for, not the old floor of 6', async () => {
    assert.equal(await countFor(5), 5);
  });

  it('gives exactly 15 when 15 is asked for, not the old ceiling of 12', async () => {
    assert.equal(await countFor(15), 15);
  });

  it('counts the word problem inside the total rather than on top of it', async () => {
    assert.equal(await countFor(10, true), 10);
  });

  it('keeps the middle of the range exact', async () => {
    assert.equal(await countFor(8), 8);
    assert.equal(await countFor(12), 12);
  });
});
