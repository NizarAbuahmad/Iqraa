/**
 * The lesson a generator screen is working on, by id, for as long as the topic
 * field still holds that lesson's title.
 *
 * A title does not identify a lesson. Every Grade 1 English lesson is
 * "Vocabulary & Grammar" or "Listening & Speaking", so re-finding one from its
 * title landed every unit on Unit 1 inside the picked scope, and on a Grade 3,
 * 4 or 9 lesson outside it (a teacher's review, 2026-10-15). The screens hold
 * the id they were given — TopicSelector's `onSelectionDetail`, or a `lessonId`
 * route param from a lesson page, the lesson bar or a saved material — and
 * pass it to `resolveGeneratorGrounding`, where an id wins over the title.
 *
 * Free of react-native.
 */
import type { Lang } from './i18n.ts';
import { getBookForLesson, getLessonById, type KbScope } from './knowledgeBase.ts';

export type PickedLesson = { lessonId: string; topic: string } | null;

/** What TopicSelector's detail says was tapped: a lesson, or nothing (a unit, a book, cleared). */
export function pickFromDetail(d: { lessonId: string | null; lessonTitle: string | null }): PickedLesson {
  return d.lessonId && d.lessonTitle?.trim() ? { lessonId: d.lessonId, topic: d.lessonTitle.trim() } : null;
}

/**
 * The picked lesson's id, or undefined once the topic is no longer its title
 * (the teacher typed over it) or the pickers have moved to another grade or
 * subject — an id from another book would otherwise win over everything the
 * screen now says.
 */
export function pickedLessonId(picked: PickedLesson, topic: string, scope: KbScope): string | undefined {
  if (!picked || picked.topic !== topic.trim()) return undefined;
  const lesson = getLessonById(picked.lessonId);
  const book = lesson ? getBookForLesson(lesson) : undefined;
  if (!book) return undefined;
  if (scope.gradeId && book.gradeId !== scope.gradeId) return undefined;
  if (scope.subjectId && book.subjectId !== scope.subjectId) return undefined;
  return picked.lessonId;
}

/** A carried lesson's own title in the material's language — what the topic field should open with. */
export function carriedLessonTopic(lessonId: string | undefined, lang: Lang): string | undefined {
  const lesson = lessonId ? getLessonById(lessonId) : undefined;
  if (!lesson) return undefined;
  return lang === 'ar' ? lesson.titleAr : lesson.titleEn;
}
