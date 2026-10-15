/**
 * The model calls Slides Maker makes for a deck: its plan, its formative
 * checks, and — for a single lesson only — its explanation.
 *
 * Lifted out of `app/ai-tools/slides.tsx` so `node --test` can pin them. A
 * single-lesson body must stay byte-identical (the shared pool keys on it); a
 * unit / semester / book body must carry the scope on BOTH calls, merged last
 * so its explicit-undefined `lessonId` / `unitId` clear anything lesson-shaped.
 *
 * Free of react-native.
 */
import type { AIRequest, ClassroomActivityRequest } from './ai/AIService.ts';
import { regenerationFields } from './ai/regeneration.ts';
import { buildLessonTeachingRequest } from './generatorRequests.ts';
import { figureCountForLesson, nccdUnitId, type GeneratorGrounding } from './kbContext.ts';
import { EXIT_TICKET_MAX, MID_LESSON_CHECK_MAX } from './lessonSlides.ts';
import type { ScopeRequestFields } from './wideScopeRequest.ts';

export type SlidesForm = {
  /** Localised grade name — display only, carried into the content verbatim. */
  gradeName: string;
  /** English subject name — the string the generators branch on. */
  subjectName: string;
  /** Trimmed. For a wide scope, its label; nothing re-grounds it. */
  topic: string;
  isAr: boolean;
};

/** What a single-lesson deck anchors its calls to, resolved once by the screen; `{}` for a wide deck. */
export type SlidesLessonFields = {
  additionalContext?: string;
  unitId?: string;
  lessonId?: string;
  bookFigureCount?: number;
};

/**
 * A single-lesson deck's fields, read off the grounding the screen already
 * resolved — never by grounding the title again. Grade 1 English titles every
 * lesson "Vocabulary & Grammar" or "Listening & Speaking", so a second lookup
 * by title landed on a Grade 3, 4 or 9 lesson even when the first one had been
 * given the tapped lesson's id. For a lesson the title alone finds, the fields
 * are exactly what the four title lookups gave (the shared pool keys on them).
 */
export function slidesLessonFields(grounding: GeneratorGrounding): SlidesLessonFields {
  return {
    additionalContext: grounding.grounded ? grounding.context : grounding.ungroundedNote,
    unitId: nccdUnitId(grounding.lesson?.unitId),
    lessonId: grounding.lesson?.id,
    bookFigureCount: figureCountForLesson(grounding.lesson?.id),
  };
}

/** The lesson plan the deck's connective tissue comes from. */
export function slidesPlanRequest(
  form: SlidesForm,
  lesson: SlidesLessonFields,
  wide: ScopeRequestFields | null,
): AIRequest {
  return {
    grade: form.gradeName,
    subject: form.subjectName,
    topic: form.topic,
    language: form.isAr ? 'arabic' : 'english',
    additionalContext: lesson.additionalContext,
    unitId: lesson.unitId,
    lessonId: lesson.lessonId,
    bookFigureCount: lesson.bookFigureCount,
    contextSource: 'curriculum',
    ...(wide ?? {}),
  };
}

/**
 * The formative checks: two mid-session checks plus a three-question exit
 * ticket, so exactly what the deck places is asked for and nothing is thrown away.
 */
export function slidesChecksRequest(
  form: SlidesForm,
  lesson: SlidesLessonFields,
  wide: ScopeRequestFields | null,
): ClassroomActivityRequest {
  return {
    grade: form.gradeName,
    subject: form.subjectName,
    topic: form.topic,
    activityType: 'quick-check',
    duration: 10,
    difficulty: 'standard',
    groupType: 'whole-class',
    teachingGoal: 'assessment',
    language: form.isAr ? 'arabic' : 'english',
    numQuestions: MID_LESSON_CHECK_MAX + EXIT_TICKET_MAX,
    additionalContext: lesson.additionalContext,
    unitId: lesson.unitId,
    lessonId: lesson.lessonId,
    contextSource: 'curriculum',
    ...(wide ?? {}),
  };
}

/**
 * The explanation section (`/generate/lesson-teaching`), or null for a wide
 * deck: its prompt is single-lesson by design («التزم بهذا الدرس وحده») and it
 * is the one call with no offline twin, so a revision deck does without it.
 */
export function slidesTeachingRequest(
  form: SlidesForm,
  grounding: GeneratorGrounding,
  regen: ReturnType<typeof regenerationFields>,
  wide: ScopeRequestFields | null,
): AIRequest | null {
  if (wide) return null;
  return buildLessonTeachingRequest({
    gradeName: form.gradeName,
    subjectName: form.subjectName,
    topic: form.topic,
    lang: form.isAr ? 'ar' : 'en',
  }, grounding, regen);
}
