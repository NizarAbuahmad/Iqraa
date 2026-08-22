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

describe('off-topic questions are declined, not taught', () => {
  const offTopic: Array<[string, 'ar' | 'en']> = [
    ['ما هي أخبار الحرب في إيران؟', 'ar'],
    ['شو أخبار السياسة اليوم؟', 'ar'],
    ["what's the news about the iran war?", 'en'],
    ['who won the football match yesterday?', 'en'],
    ['كم سعر الدولار اليوم؟', 'ar'],
    ['what is the weather forecast tomorrow?', 'en'],
    ['اقترح لي فيلماً جيداً', 'ar'],
    ['give me a recipe for pasta', 'en'],
  ];

  for (const [q, lang] of offTopic) {
    it(`declines "${q}"`, () => {
      const route = classifyChatIntent(q, lang);
      assert.equal(route.intent, 'off_topic');
      assert.equal(route.useTeachingPipeline, false);
      assert.ok(route.socialReply);
    });
  }

  it('says what it is for and offers what it can do', () => {
    const ar = classifyChatIntent('ما أخبار الحرب في إيران؟', 'ar').socialReply ?? '';
    assert.match(ar, /مساعد تدريس/);
    assert.match(ar, /خارج مجال عملي/);
    assert.match(ar, /خطة درس/);

    const en = classifyChatIntent('any news about the war?', 'en').socialReply ?? '';
    assert.match(en, /teaching assistant/i);
    assert.match(en, /outside what I do/i);
    assert.match(en, /lesson plan/i);
  });

  it('declines even after a clarify — the answer is still not a teaching topic', () => {
    assert.equal(classifyChatIntent('أخبار إيران', 'ar', true).intent, 'off_topic');
  });
});

describe('teaching work that merely mentions the outside world still routes to teaching', () => {
  const teaching: Array<[string, 'ar' | 'en']> = [
    // A statistics worksheet about currency prices is a worksheet.
    ['أنشئ ورقة عمل إحصاء عن أسعار الدولار', 'ar'],
    ['اشرح لطلابي المتجهات بمثال عن مباراة كرة القدم', 'ar'],
    ['make a quiz about probability using football scores', 'en'],
    // The words the off-topic lists must never claim from the curriculum.
    ['اشرح الجدول الدوري', 'ar'],
    ['ما هي الفكرة الرئيسية في درس المشتقات؟', 'ar'],
  ];

  for (const [q, lang] of teaching) {
    it(`keeps "${q}" in the teaching pipeline`, () => {
      const route = classifyChatIntent(q, lang);
      assert.notEqual(route.intent, 'off_topic');
      assert.equal(route.useTeachingPipeline, true);
    });
  }
});
