/**
 * The lesson picked in chat is background, not a leash.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/lessonPinGate.test.ts
 *
 * The chat screen used to push the picked lesson into every answer's grounding
 * ahead of this gate, so a teacher who had picked a lesson got every later
 * question answered about it. The screen now defers to `shouldReuseActiveLesson`
 * alone; these pin the cases that change hinges on.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { shouldReuseActiveLesson } from '../lessonCopilot.ts';
import { emptyChatSessionMemory } from '../ai/teachingAssistant.ts';

const hardPinned = {
  ...emptyChatSessionMemory(),
  activeLessonId: 'kbl-math-s2-nccd-u5_l3',
  activeTopicAr: 'تركيب الاقترانات',
  lessonPin: 'hard' as const,
};

describe('shouldReuseActiveLesson with a lesson picked in chat', () => {
  it('lets go when the question clearly matches another lesson', () => {
    assert.equal(
      shouldReuseActiveLesson({
        memory: hardPinned,
        intent: 'teaching',
        query: 'اشرح الروابط التساهمية',
        hasConfidentKbHit: true,
      }),
      false,
    );
  });

  it('keeps the lesson for a refinement of the last answer', () => {
    assert.equal(
      shouldReuseActiveLesson({
        memory: hardPinned,
        intent: 'refinement',
        query: 'اجعله أبسط',
        hasConfidentKbHit: true,
      }),
      true,
    );
  });

  it('keeps it for material requested without naming a topic', () => {
    assert.equal(
      shouldReuseActiveLesson({
        memory: hardPinned,
        intent: 'artifact',
        query: 'ورقة عمل',
        hasConfidentKbHit: false,
      }),
      true,
    );
  });
});
