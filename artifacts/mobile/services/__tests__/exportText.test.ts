import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatAttemptResultText, formatWorksheetText } from '../exportText.ts';
import type { WorksheetOutput } from '../ai/AIService.ts';
import type { AttemptResult } from '../evaluations.ts';

const meta = { subject: 'الرياضيات', grade: 'الصف العاشر' };

const worksheet = (): WorksheetOutput => ({
  instructions: 'أجب عن جميع الأسئلة.',
  sections: [{
    title: 'القسم الأول',
    questions: [{ text: 'أي مما يلي صحيح؟', options: ['أ) الأول', 'ب) الثاني'], points: 2 }],
  }],
  answerKey: [{ num: 1, answer: 'الأول' }],
}) as unknown as WorksheetOutput;

describe('formatWorksheetText answer key', () => {
  it('includes the key by default, for every existing caller', () => {
    const text = formatWorksheetText(worksheet(), 'ورقة عمل', meta, true);
    assert.ok(text.includes('مفتاح الإجابات'));
  });

  it('drops the key when a teacher shares without answers', () => {
    const text = formatWorksheetText(worksheet(), 'ورقة عمل', meta, true, false);
    assert.ok(!text.includes('مفتاح الإجابات'));
    assert.ok(!text.includes('1. الأول'), 'the keyed answer line leaked without the header');
  });
});

describe('formatAttemptResultText marks', () => {
  it('prints the numeric column\'s «10.00 / 100.00» without the trailing decimals', () => {
    const result = {
      attemptId: 'a', earnedMarks: '10.00', totalMarks: '100.00', percent: '10.00',
      competencyScores: {}, levelKey: 'beginner', isProvisional: false,
    } as unknown as AttemptResult;
    const text = formatAttemptResultText(result, 'Ali', 'تقييم', true);
    assert.ok(text.includes('10 / 100'), text);
    assert.ok(text.includes('(10%)'), text);
    assert.ok(!text.includes('.00'), text);
  });
});
