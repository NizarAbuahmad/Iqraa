/**
 * Turns a curriculum lesson into a ready-to-send lesson-plan request.
 *
 * The curriculum browser already knows everything the lesson-plan form asks
 * for — the book fixes the grade and the subject, the lesson fixes the topic,
 * its objectives and how long it runs. Sending the teacher to the AI Tools form
 * to re-pick all of it was asking them to retype what they had just navigated
 * through, and it lost information on the way: the button passed
 * `lesson.title`, the English title, while the UI (and the KB search) was
 * Arabic, so `resolveGeneratorGrounding` could not match it and a lesson that
 * is in the NCCD book came back labelled "not grounded in the curriculum".
 *
 * Pure TypeScript, no React — the screen renders it, this decides it, and the
 * tests can run it.
 */
import {
  getBookById,
  getLessonById,
  getPickerGrades,
  getPickerSubjects,
  getUnitById,
} from './curriculumData.ts';
import type { AIRequest } from './ai/AIService.ts';
import { buildAdaptationsDirective, resolveGeneratorGrounding } from './kbContext.ts';

export type TeachingStyle = 'direct' | 'inquiry' | 'collaborative';

/** Everything the generators need about a lesson, resolved from its id. */
export type LessonPrepContext = {
  lessonId: string;
  gradeId: string;
  subjectId: string;
  /** Localised grade name — displayed and carried into generated content. */
  gradeName: string;
  /**
   * English subject name. Left in English on purpose: it feeds `isMathContext`
   * and ~30 other call sites, exactly as on the lesson-plan screen.
   */
  subjectName: string;
  /** Localised subject name — for headers and exports only. */
  subjectLabel: string;
  /** Localised lesson title. This is the topic the KB is searched with. */
  topic: string;
  /** Localised lesson objectives, one per line. */
  objectives: string;
  /** The lesson's own period length, in minutes. */
  duration: number;
};

export type LessonPrepRequest = {
  context: LessonPrepContext;
  request: AIRequest;
  /** True only when the topic matched a curriculum lesson with confidence. */
  grounded: boolean;
  /** Title of the KB lesson the plan is anchored to, when grounded. */
  groundedLessonTitle: string | null;
};

/** Resolve a lesson's grade, subject, title and objectives in one place. */
export function resolveLessonPrepContext(
  lessonId: string,
  lang: 'ar' | 'en',
): LessonPrepContext | null {
  const lesson = getLessonById(lessonId);
  if (!lesson) return null;

  const unit = getUnitById(lesson.unitId);
  const book = unit ? getBookById(unit.bookId) : undefined;
  if (!book) return null;

  const isAr = lang === 'ar';
  const grade = getPickerGrades().find(g => g.id === book.gradeId);
  const subject = getPickerSubjects().find(s => s.id === book.subjectId);
  const objectives = isAr ? (lesson.objectivesAr ?? lesson.objectives) : lesson.objectives;

  return {
    lessonId: lesson.id,
    gradeId: book.gradeId,
    subjectId: book.subjectId,
    gradeName: grade ? (isAr ? grade.nameAr : grade.name) : book.gradeId,
    subjectName: subject ? subject.name : book.subjectId,
    subjectLabel: subject ? (isAr ? subject.nameAr : subject.name) : book.subjectId,
    topic: isAr ? (lesson.titleAr || lesson.title) : lesson.title,
    objectives: (objectives ?? []).join('\n'),
    duration: lesson.estimatedDuration,
  };
}

/**
 * Route params that open a generator screen on a lesson's own grade and
 * subject, ready to spread into `router.push({ params })`.
 *
 * Every generator screen reads `gradeIdx` / `subjectIdx` and falls back to
 * index 0 — Grade 10 *Mathematics* — when they are absent. That default is
 * silent and it is not cosmetic: the screen generates with
 * `subjects[subjectIdx].name`, and `isMathContext` branches on that string, so
 * a chemistry lesson opened without these params is served maths questions
 * from the concrete bank under the chemistry title. The AI-tools hub and
 * `LessonPrepPanel` already pass them; chat did not.
 *
 * Returns `null` for an unknown or absent lesson, so the caller adds nothing
 * and the screen keeps its own default rather than being sent to a subject
 * nobody chose.
 */
export function lessonPickerParams(
  lessonId: string | null | undefined,
  lang: 'ar' | 'en',
): { gradeIdx: string; subjectIdx: string } | null {
  if (!lessonId) return null;
  const context = resolveLessonPrepContext(lessonId, lang);
  if (!context) return null;
  const { gradeIdx, subjectIdx } = lessonPrepPickerIndices(context);
  return { gradeIdx: String(gradeIdx), subjectIdx: String(subjectIdx) };
}

/**
 * Where this lesson sits in the AI-tools pickers, so handing off to the full
 * tool arrives on the right grade and subject instead of on index 0.
 */
export function lessonPrepPickerIndices(
  context: LessonPrepContext,
): { gradeIdx: number; subjectIdx: number } {
  const gradeIdx = getPickerGrades().findIndex(g => g.id === context.gradeId);
  const subjectIdx = getPickerSubjects().findIndex(s => s.id === context.subjectId);
  return {
    gradeIdx: gradeIdx < 0 ? 0 : gradeIdx,
    subjectIdx: subjectIdx < 0 ? 0 : subjectIdx,
  };
}

/**
 * Build the generator request for a curriculum lesson.
 *
 * Grounding is resolved here rather than by the caller so that the request and
 * the badge the teacher sees can never disagree about what the plan is
 * anchored to.
 */
export function buildLessonPrepRequest(args: {
  lessonId: string;
  lang: 'ar' | 'en';
  /** Overrides the lesson's own period length. */
  duration?: number;
  teachingStyle?: TeachingStyle;
  /** Free-text delivery instructions ("adapt this for a student with ADHD"). */
  adaptations?: string;
}): LessonPrepRequest | null {
  const context = resolveLessonPrepContext(args.lessonId, args.lang);
  if (!context) return null;

  const grounding = resolveGeneratorGrounding(context.topic, args.lang, {
    teacherObjectives: context.objectives || undefined,
  });
  const additionalContext = [
    grounding.grounded ? grounding.context : grounding.ungroundedNote,
    buildAdaptationsDirective(args.adaptations ?? '', args.lang),
  ].filter(Boolean).join('\n') || undefined;

  return {
    context,
    grounded: grounding.grounded,
    groundedLessonTitle: grounding.lesson
      ? (args.lang === 'ar' ? grounding.lesson.titleAr : grounding.lesson.titleEn)
      : null,
    request: {
      grade: context.gradeName,
      subject: context.subjectName,
      topic: context.topic,
      duration: args.duration ?? context.duration,
      language: args.lang === 'ar' ? 'arabic' : 'english',
      teachingStyle: args.teachingStyle ?? 'direct',
      objectives: context.objectives || undefined,
      additionalContext,
    },
  };
}
