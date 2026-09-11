import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDeepLinkSend } from '../chatDeepLink.ts';

describe('resolveDeepLinkSend', () => {
  it('carries the lesson through as the pin', () => {
    // The regression this file exists for: the lesson arrived on the deep link
    // and was dropped before `sendMessage`, so the reply was grounded on
    // whatever lesson chat had already selected.
    const send = resolveDeepLinkSend({
      initialMessage: 'ما الذي يجب أن أعرفه قبل تدريس «قانون الجيوب»؟',
      lessonId: 'kbl-math-s1-nccd-u3_l2',
      subjectColor: '#8B5CF6',
    });
    assert.equal(send?.pinnedLessonId, 'kbl-math-s1-nccd-u3_l2');
  });

  it('carries the tapped shelf document through as well', () => {
    const send = resolveDeepLinkSend({
      initialMessage: 'بالاستفادة من «ورقة عمل»، ساعدني في التحضير لدرس: الدائرة',
      lessonId: 'kbl-math-s1-nccd-u2_l1',
      resourceId: 'res-42',
    });
    assert.equal(send?.pinnedResourceId, 'res-42');
    assert.equal(send?.pinnedLessonId, 'kbl-math-s1-nccd-u2_l1');
  });

  it('leaves the resource pin unset when no document was tapped', () => {
    // The «اسأل اقرأ» button: a lesson, no file.
    const send = resolveDeepLinkSend({ initialMessage: 'س', lessonId: 'kbl-x' });
    assert.equal(send?.pinnedResourceId, undefined);
  });

  it('is null when there is nothing to say', () => {
    assert.equal(resolveDeepLinkSend({}), null);
    assert.equal(resolveDeepLinkSend({ lessonId: 'kbl-x' }), null);
  });

  it('is null for a blank message rather than an empty send', () => {
    // `sendMessage` returns early on empty text without clearing anything, so a
    // whitespace-only link left pending would be retried on every render.
    assert.equal(resolveDeepLinkSend({ initialMessage: '   ', lessonId: 'kbl-x' }), null);
  });

  it('trims the message and the ids', () => {
    const send = resolveDeepLinkSend({
      initialMessage: '  اشرح  ',
      lessonId: ' kbl-x ',
      resourceId: ' res-1 ',
    });
    assert.equal(send?.text, 'اشرح');
    assert.equal(send?.pinnedLessonId, 'kbl-x');
    assert.equal(send?.pinnedResourceId, 'res-1');
  });

  it('treats an empty id as absent, not as a pin on ""', () => {
    const send = resolveDeepLinkSend({ initialMessage: 'اشرح', lessonId: '', resourceId: '' });
    assert.equal(send?.pinnedLessonId, undefined);
    assert.equal(send?.pinnedResourceId, undefined);
  });
});
