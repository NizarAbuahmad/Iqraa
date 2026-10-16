import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { worksheetPromptAr, worksheetPromptEn } from '../prompts.ts';

const KINDS = ['match', 'order', 'spot_error', 'graph'];

describe('worksheet prompt and formats', () => {
  it('never asks the model for a bank-only format', () => {
    const body = { topic: 'المعادلات الأسية', subject: 'الرياضيات', grade: '10', numQuestions: 8, questionTypes: ['short_answer', ...KINDS] } as any;
    for (const p of [worksheetPromptAr(body), worksheetPromptEn(body)]) {
      // Whole-word hits are ordinary prose ("a matching answerKey entry",
      // "the working in order"), so look for the kind where a TYPE is listed.
      for (const k of KINDS) assert.ok(!new RegExp(`(?:^|[,:]\\s*)${k}\\s*(?:,|$)`, 'm').test(p), `${k} leaked into the prompt's type list`);
      assert.ok(!p.includes('spot_error') && !p.includes('graph'), 'a bank-only token leaked');
    }
  });

  it('keeps the types the model is meant to write', () => {
    const body = { topic: 't', subject: 's', grade: '10', numQuestions: 8, questionTypes: ['multiple_choice', 'match'] } as any;
    for (const p of [worksheetPromptAr(body), worksheetPromptEn(body)]) {
      assert.ok(p.includes('multiple_choice'));
    }
  });

  it('falls back to short_answer when only formats were picked', () => {
    const body = { topic: 't', subject: 's', grade: '10', numQuestions: 8, questionTypes: ['match', 'order'] } as any;
    for (const p of [worksheetPromptAr(body), worksheetPromptEn(body)]) {
      assert.ok(p.includes('short_answer'));
    }
  });
});
