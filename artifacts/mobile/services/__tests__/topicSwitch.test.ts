/**
 * Changing subject by typing.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/topicSwitch.test.ts
 *
 * Reported from app.iqrra.com on 2026-09-19: after a good first answer on a
 * Grade 1 music lesson, "can we now talk about biology" came back as the same
 * music lesson, opened with «حاضر، لنربط الإجابة بدرسك الحالي». The lesson had
 * been hard-pinned by the first reply, the keyword search could not score the
 * sentence, and `shouldReuseActiveLesson` read "hard pin + weak search" as
 * "stay". A sentence that names a new topic must never be read that way.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { shouldReuseActiveLesson, topicSwitchTarget } from '../lessonCopilot.ts';
import { emptyChatSessionMemory } from '../ai/teachingAssistant.ts';

describe('topicSwitchTarget', () => {
  const switches: Array<[string, string]> = [
    ['can we now talk about biology', 'biology'],
    ['Can we talk about biology?', 'biology'],
    ["let's move on to fractions", 'fractions'],
    ['switch to the water cycle please', 'the water cycle'],
    ['change the lesson to photosynthesis', 'photosynthesis'],
    ['خلينا نتكلم عن الأحياء', 'الأحياء'],
    ['ممكن نتحدث عن الكسور؟', 'الكسور'],
    ['ننتقل إلى دورة الماء', 'دورة الماء'],
    ['غيّر الدرس إلى التركيب الضوئي', 'التركيب الضوئي'],
    ['بدي ننتقل الآن إلى الجمع', 'الجمع'],
    ['درس آخر: الكسور', 'الكسور'],
  ];
  for (const [sentence, topic] of switches) {
    it(`"${sentence}" names "${topic}"`, () => {
      assert.equal(topicSwitchTarget(sentence), topic);
    });
  }

  it('is a switch with no target when the teacher only says "something else"', () => {
    assert.equal(topicSwitchTarget('can we talk about something else'), '');
    assert.equal(topicSwitchTarget('موضوع آخر'), '');
    assert.equal(topicSwitchTarget('change the subject'), '');
  });

  const stays = [
    'أضف نشاطاً لهذا الدرس',
    'نتكلم عن هذا الدرس أكثر',
    "let's talk about this lesson more",
    'كيف أشرح الكسور؟',
    'خطة درس',
    'what is a fraction?',
    'اختبار قصير عن الكسور',
  ];
  for (const sentence of stays) {
    it(`"${sentence}" is not a switch`, () => {
      assert.equal(topicSwitchTarget(sentence), null);
    });
  }
});

describe('shouldReuseActiveLesson on a topic switch', () => {
  const hardPinned = {
    ...emptyChatSessionMemory(),
    activeLessonId: 'g1-arts-s1-u1-l1',
    activeTopicAr: 'التعبير بالصوت والجسد',
    lessonPin: 'hard' as const,
  };

  it('keeps the hard pin for an ordinary weak-search teaching ask', () => {
    assert.equal(
      shouldReuseActiveLesson({
        memory: hardPinned,
        intent: 'teaching',
        query: 'كيف أبدأ الحصة',
        hasConfidentKbHit: false,
      }),
      true,
    );
  });

  it('drops it the moment the teacher names another topic', () => {
    for (const query of ['can we now talk about biology', 'خلينا نتكلم عن الأحياء']) {
      assert.equal(
        shouldReuseActiveLesson({
          memory: hardPinned,
          intent: 'teaching',
          query,
          hasConfidentKbHit: false,
        }),
        false,
        query,
      );
    }
  });
});
