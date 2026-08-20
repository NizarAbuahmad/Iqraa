/**
 * Intent router tests.
 *
 * Runs with Node's built-in test runner:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/intentRouter.test.ts
 *
 * The case that matters: every answer the clarify question itself offers must
 * classify. "شرح مفهوم" used to fall through to the same clarify reply, so a
 * teacher who answered the question was asked it again, forever.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { classifyChatIntent } from '../ai/intentRouter.ts';

describe('the clarify question is answerable', () => {
  const offered: Array<[string, string]> = [
    ['شرح مفهوم', 'teaching'],
    ['شرح', 'teaching'],
    ['خطة درس', 'artifact'],
    ['ورقة عمل', 'artifact'],
    ['اختبار', 'artifact'],
  ];

  for (const [answer, intent] of offered) {
    it(`routes "${answer}" to ${intent}, not back to clarify`, () => {
      const route = classifyChatIntent(answer, 'ar');
      assert.equal(route.intent, intent);
      assert.equal(route.useTeachingPipeline, true);
    });
  }

  it('routes the English options too', () => {
    assert.equal(classifyChatIntent('concept explanation', 'en').intent, 'teaching');
    assert.equal(classifyChatIntent('worksheet', 'en').intent, 'artifact');
  });
});

describe('clarify never repeats', () => {
  it('asks once for an unclassifiable short message', () => {
    const route = classifyChatIntent('همم', 'ar');
    assert.equal(route.intent, 'ambiguous');
    assert.ok(route.socialReply);
  });

  it('sends the next unclassifiable message to teaching instead of re-asking', () => {
    const route = classifyChatIntent('همم', 'ar', true);
    assert.equal(route.intent, 'teaching');
    assert.equal(route.useTeachingPipeline, true);
    assert.equal(route.socialReply, undefined);
  });

  it('still greets and small-talks after a clarify — those are not dead ends', () => {
    assert.equal(classifyChatIntent('مرحبا', 'ar', true).intent, 'greeting');
    assert.equal(classifyChatIntent('شكرا', 'ar', true).intent, 'small_talk');
  });
});

describe('social intents still bypass the teaching pipeline', () => {
  it('greeting', () => {
    const route = classifyChatIntent('السلام عليكم', 'ar');
    assert.equal(route.intent, 'greeting');
    assert.equal(route.useTeachingPipeline, false);
  });

  it('thanks', () => {
    assert.equal(classifyChatIntent('شكراً', 'ar').intent, 'small_talk');
  });
});
