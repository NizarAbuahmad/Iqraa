/**
 * The lesson a generator screen is working on, by id — see
 * `services/pickedLesson.ts` for why a title is not enough.
 *
 * Seeded from the `lessonId` route param when the screen opens with a topic,
 * then replaced by whatever the teacher taps in TopicSelector. `lessonId` is
 * undefined as soon as the topic is no longer that lesson's title or the
 * pickers leave its grade or subject, so it never needs clearing by hand.
 * Pass it to `resolveGeneratorGrounding` as `{ lessonId, scope }`.
 */
import { useState } from 'react';
import type { KbScope } from '@/services/knowledgeBase';
import { pickFromDetail, pickedLessonId, type PickedLesson } from '@/services/pickedLesson';

export function usePickedLesson(carriedLessonId: string | undefined, topic: string, scope: KbScope) {
  const [picked, setPicked] = useState<PickedLesson>(
    () => (carriedLessonId && topic.trim() ? { lessonId: carriedLessonId, topic: topic.trim() } : null),
  );
  return {
    lessonId: pickedLessonId(picked, topic, scope),
    onSelectionDetail: (d: { lessonId: string | null; lessonTitle: string | null }) => setPicked(pickFromDetail(d)),
  };
}
