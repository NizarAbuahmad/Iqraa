import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatWorksheetText } from '../exportText.ts';
import type { WorksheetOutput } from '../ai/AIService.ts';

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
