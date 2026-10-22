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
import { applySlideTextEdit, pictureSlot, slidePicture, withSlidePicture } from '../slideEdit.ts';
import { resolveSlideLayout } from '../slideLayout.ts';

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

const slide = (extra: Partial<ActivitySlide>): ActivitySlide =>
  ({ slideNumber: 2, type: 'intro', title: 'عنوان', content: '• أ\n• ب', durationSeconds: 0, ...extra } as ActivitySlide);
const credit = { photographer: 'Ada', photographerUrl: 'https://unsplash.com/@ada', unsplashUrl: 'https://unsplash.com/' };

describe('slide pictures', () => {
  it('offers a picture only where every renderer draws one', () => {
    assert.equal(pictureSlot(slide({}), 1), 'side');
    assert.equal(pictureSlot(slide({ type: 'summary' }), 9), 'side');
    assert.equal(pictureSlot(slide({}), 0), 'background', 'the cover');
    assert.equal(pictureSlot(slide({ type: 'divider' }), 4), 'background');
    assert.equal(pictureSlot(slide({ type: 'media', mediaKind: 'image', mediaUrl: 'https://x/a.png' }), 3), 'media');
    for (const type of ['question', 'challenge', 'graph'] as const) assert.equal(pictureSlot(slide({ type }), 3), null, type);
    assert.equal(pictureSlot(slide({ type: 'media', mediaKind: 'video' }), 3), null, 'a video slide keeps its own link field');
  });

  it('adds a picture beside the text, and a layout gives way to it', () => {
    const cards = slide({ layout: 'concepts', concepts: ['أ', 'ب', 'ج'] });
    const out = withSlidePicture(cards, 2, { url: 'data:image/jpeg;base64,AAA' });
    assert.equal(out.sideImageUrl, 'data:image/jpeg;base64,AAA');
    assert.equal(out.layout, undefined, 'cards fill the slide and would hide the picture');
    assert.equal(out.content, cards.content, 'the bullets stay as the text');
    assert.deepEqual(slidePicture(out, 2), { url: 'data:image/jpeg;base64,AAA' });
  });

  it('replaces a picture with a suggested photo, credit and all, and removes it cleanly', () => {
    const old = slide({ sideImageUrl: 'https://x/old.png', sideImageCaption: 'قديمة', sideImageCredit: credit });
    const swapped = withSlidePicture(old, 2, { url: 'https://images.unsplash.com/new', caption: '📷 Ada · Unsplash', credit });
    assert.equal(swapped.sideImageUrl, 'https://images.unsplash.com/new');
    assert.equal(swapped.sideImageCaption, '📷 Ada · Unsplash');
    const uploaded = withSlidePicture(old, 2, { url: 'data:image/jpeg;base64,BBB' });
    assert.equal(uploaded.sideImageCaption, undefined, "the old photo's credit must not label the new one");
    assert.equal(uploaded.sideImageCredit, undefined);
    const removed = withSlidePicture(old, 2, null);
    assert.ok(!('sideImageUrl' in removed) && !('sideImageCaption' in removed) && !('sideImageCredit' in removed));
  });

  it('removing the picture of a photo-layout slide leaves an ordinary slide, not an empty dark one', () => {
    const photo = slide({ layout: 'photo', content: 'جملة واحدة', sideImageUrl: 'https://x/p.jpg' });
    const out = withSlidePicture(photo, 2, null);
    assert.equal(out.layout, undefined);
    assert.equal(resolveSlideLayout(out), null);
  });

  it('sets and clears the cover and divider background', () => {
    const cover = withSlidePicture(slide({ slideNumber: 1 }), 0, { url: 'https://images.unsplash.com/c', caption: 'c', credit });
    assert.equal(cover.mediaUrl, 'https://images.unsplash.com/c');
    assert.equal(cover.mediaKind, undefined, 'a background is not a picture slide');
    const bare = withSlidePicture(cover, 0, null);
    assert.ok(!('mediaUrl' in bare) && !('mediaCaption' in bare) && !('mediaCredit' in bare));
  });

  it("swaps a picture slide's picture but never empties it, and ignores slides with no slot", () => {
    const media = slide({ type: 'media', mediaKind: 'image', mediaUrl: 'https://x/a.png', mediaCaption: 'كتاب الطالب · صفحة ٣' });
    assert.equal(withSlidePicture(media, 3, { url: 'data:image/png;base64,C' }).mediaUrl, 'data:image/png;base64,C');
    assert.equal(withSlidePicture(media, 3, null), media);
    const q = slide({ type: 'question', options: ['1', '2'], correctIndex: 0 });
    assert.equal(withSlidePicture(q, 3, { url: 'https://x/q.png' }), q);
  });
});
