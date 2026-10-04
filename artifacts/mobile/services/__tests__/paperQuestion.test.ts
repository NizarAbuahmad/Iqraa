import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { isPaperQuestion } from '../paperQuestion.ts';

describe('isPaperQuestion', () => {
  it('is a paper question when an open-answer type carries no prompt', () => {
    // What PUT /evaluations/:id/questions/paper stores: open_ended, body {}.
    assert.equal(isPaperQuestion({ type: 'open_ended', body: {} }), true);
    assert.equal(isPaperQuestion({ type: 'short_answer', body: { prompt: '  ' } }), true);
  });

  it('is not one when the open-answer prompt is there', () => {
    assert.equal(isPaperQuestion({ type: 'short_answer', body: { prompt: 'اشرح' } }), false);
  });

  it('never labels a type whose text lives elsewhere — the marking screen called every one of these a paper question', () => {
    assert.equal(isPaperQuestion({ type: 'multiple_choice', body: { stem: 'ما…؟', options: [] } }), false);
    assert.equal(isPaperQuestion({ type: 'true_false', body: { statement: '…' } }), false);
    assert.equal(isPaperQuestion({ type: 'matching', body: { left: [], right: [] } }), false);
    assert.equal(isPaperQuestion({ type: 'fill_blank', body: { template: '… ___' } }), false);
    assert.equal(isPaperQuestion({ type: 'dictation', body: { mode: 'write' } }), false);
    assert.equal(isPaperQuestion({ type: 'read_aloud', body: { passage: '…' } }), false);
  });
});
