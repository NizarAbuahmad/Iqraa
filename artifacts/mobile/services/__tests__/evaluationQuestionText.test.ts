import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { questionText } from '../evaluationQuestionText.ts';

const q = (type: string, body: Record<string, unknown>) => ({ type, body, expectedAnswer: {} }) as any;
const strip = (s: string) => s.replace(/[⁦⁩]/g, '');

describe('evaluation review: questionText', () => {
  it('a matching question with a stem shows the stem AND both columns', () => {
    const t = strip(questionText(q('matching', {
      stem: 'صِل كل سؤال بإجابته.',
      left: [{ id: 'l0', text: 'PROB-ONE' }, { id: 'l1', text: 'PROB-TWO' }],
      right: [{ id: 'r0', text: 'ANS-A' }, { id: 'r1', text: 'ANS-B' }],
    }), true));
    for (const part of ['صِل كل سؤال بإجابته.', 'PROB-ONE', 'PROB-TWO', 'ANS-A', 'ANS-B']) assert.ok(t.includes(part), part);
    assert.ok(t.indexOf('صِل') < t.indexOf('PROB-ONE') && t.indexOf('PROB-TWO') < t.indexOf('ANS-A'), 'stem, then problems, then answers');
    assert.match(t, /١\) PROB-ONE/);
    assert.match(t, /أ\) ANS-A/);
  });

  it('an order question shows its steps and the positions', () => {
    const t = strip(questionText(q('matching', {
      stem: 'طابق كل خطوة بترتيبها في الحل.\nرتّب خطوات حل المسألة الآتية:',
      left: [{ id: 's0', text: 'STEP-X' }, { id: 's1', text: 'STEP-Y' }],
      right: [{ id: 'p0', text: 'الأولى' }, { id: 'p1', text: 'الثانية' }],
    }), true));
    assert.ok(t.includes('STEP-X') && t.includes('STEP-Y') && t.includes('الأولى') && t.includes('الثانية'));
  });

  it('English numbering on an English screen', () => {
    const t = strip(questionText(q('matching', { stem: 'Match.', left: [{ id: 'l0', text: 'P' }], right: [{ id: 'r0', text: 'A' }] }), false));
    assert.match(t, /1\) P/);
    assert.match(t, /A\) A/);
  });

  it('a matching question without a stem still shows its left column, as before', () => {
    const t = strip(questionText(q('matching', { left: [{ id: 'l0', text: 'L1' }, { id: 'l1', text: 'L2' }], right: [] }), true));
    assert.equal(t, 'L1 · L2');
  });

  it('other types are unchanged: stem, then template, then prompt', () => {
    assert.equal(strip(questionText(q('multiple_choice', { stem: 'S', options: [] }), true)), 'S');
    assert.equal(strip(questionText(q('short_answer', { prompt: 'P' }), true)), 'P');
  });
});
