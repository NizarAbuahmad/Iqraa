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

import { classifyChatIntent, leavesClarificationStanding } from '../ai/intentRouter.ts';

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

/**
 * The same dead end, reached from the other direction.
 *
 * `afterClarify` only ever knew about the local classifier's own clarify reply.
 * Two other things ask questions — a structured `pedagogicalClarification`, and
 * the live AI path's free-text "which concept?" — and neither set the flag, so
 * an answer to one of those was met with the generic clarify question again.
 * The last test here is the one that matters: it walks the whole round trip.
 */
describe('leavesClarificationStanding', () => {
  it('is exact for a structured clarification', () => {
    assert.equal(
      leavesClarificationStanding({ responseText: 'اختر:', hasStructuredClarification: true }),
      true,
    );
  });

  it('reads a short free-text question as a standing ask, in either script', () => {
    assert.equal(leavesClarificationStanding({ responseText: 'أي مفهوم تريد شرحه؟' }), true);
    assert.equal(leavesClarificationStanding({ responseText: 'Which concept shall I explain?' }), true);
    assert.equal(leavesClarificationStanding({ responseText: '  أي درس؟  ' }), true);
  });

  it('does not treat an answer as a question', () => {
    assert.equal(leavesClarificationStanding({ responseText: 'الافتراضات هي كذا وكذا.' }), false);
    assert.equal(leavesClarificationStanding({ responseText: '' }), false);
  });

  it('does not mistake a long explanation that happens to end on a question', () => {
    // The reason the cap exists: prose closing with «هل تريد المزيد؟» answered
    // something, it did not ask.
    const prose = 'شرح مطول '.repeat(60) + 'هل تريد المزيد؟';
    assert.ok(prose.length > 400, 'fixture must exceed the cap to be meaningful');
    assert.equal(leavesClarificationStanding({ responseText: prose }), false);
  });

  it('treats a produced artifact as proof the turn answered something', () => {
    // A worksheet came back; whatever the prose ends with, nothing is pending.
    assert.equal(
      leavesClarificationStanding({ responseText: 'جاهزة. أريد تعديلها؟', producedArtifact: true }),
      false,
    );
    // ...but a structured clarification still wins: it is a fact, not a guess.
    assert.equal(
      leavesClarificationStanding({
        responseText: 'اختر:',
        hasStructuredClarification: true,
        producedArtifact: true,
      }),
      true,
    );
  });

  it('forwards a one-word answer instead of re-asking — the whole point', () => {
    const asked = leavesClarificationStanding({ responseText: 'أي مفهوم تريد شرحه؟' });
    assert.equal(asked, true);

    // "الافتراضات" is short enough to hit the short-token fallback. With the
    // flag it reaches the teaching pipeline; without it the teacher is asked
    // the same generic question they just answered.
    const answered = classifyChatIntent('الافتراضات', 'ar', asked);
    assert.equal(answered.useTeachingPipeline, true);
    assert.notEqual(answered.intent, 'ambiguous');

    const withoutFlag = classifyChatIntent('الافتراضات', 'ar', false);
    assert.equal(withoutFlag.intent, 'ambiguous');
  });
});
