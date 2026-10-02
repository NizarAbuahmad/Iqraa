/**
 * The per-slide text edit shared by Slides and Prompt Slides.
 *
 * The two screens each carried a copy, and they had drifted: Slides dropped
 * the verifier's badge when the question or answer changed, Prompt Slides
 * did not; Prompt Slides left a question slide's answer alone, Slides did
 * not. One function now carries both rules.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { ActivitySlide } from '../ai/AIService.ts';
import { applySlideTextEdit } from '../slideEdit.ts';

const challenge = (extra: Partial<ActivitySlide> = {}): ActivitySlide => ({
  type: 'challenge', title: 'مثال', content: 'جد ٢+٢', answer: '4',
  verified: true, verifiedBy: 'symbolic', computedAnswer: '4', ...extra,
} as ActivitySlide);

describe('applySlideTextEdit', () => {
  it('keeps the old title when the edited one is blank', () => {
    const s = challenge();
    const out = applySlideTextEdit(s, { title: '   ', content: s.content, answer: '4' });
    assert.equal(out.title, 'مثال');
  });

  it('removes the answer when it is emptied, rather than revealing ""', () => {
    const out = applySlideTextEdit(challenge(), { title: 'مثال', content: 'جد ٢+٢', answer: '  ' });
    assert.equal('answer' in out, false);
  });

  it('drops the verifier badge when the content or the answer changes', () => {
    const changedContent = applySlideTextEdit(challenge(), { title: 'مثال', content: 'جد ٣+٣', answer: '4' });
    assert.equal(changedContent.verified, undefined);
    assert.equal(changedContent.verifiedBy, undefined);
    assert.equal(changedContent.computedAnswer, undefined);
    const changedAnswer = applySlideTextEdit(challenge(), { title: 'مثال', content: 'جد ٢+٢', answer: '5' });
    assert.equal(changedAnswer.verified, undefined);
  });

  it('keeps the badge on a title-only edit — the maths is untouched', () => {
    const out = applySlideTextEdit(challenge(), { title: 'مثال محلول', content: 'جد ٢+٢', answer: '4' });
    assert.equal(out.title, 'مثال محلول');
    assert.equal(out.verified, true);
  });

  it("leaves a question slide's answer alone — it lives in options/correctIndex", () => {
    const q = { type: 'question', title: 'س', content: 'اختر', answer: 'ب' } as ActivitySlide;
    const out = applySlideTextEdit(q, { title: 'س', content: 'اختر', answer: '' });
    assert.equal(out.answer, 'ب');
  });

  it('does not add an answer to a slide that never had one when none is typed', () => {
    const s = { type: 'intro', title: 'ت', content: 'نص' } as ActivitySlide;
    const out = applySlideTextEdit(s, { title: 'ت', content: 'نص', answer: '' });
    assert.equal('answer' in out, false);
  });
});
