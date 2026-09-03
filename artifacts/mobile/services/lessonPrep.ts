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
  getObjectiveById,
  getPickerGrades,
  getPickerSubjects,
  getUnitById,
} from './curriculumData.ts';
import type { Subject } from './curriculumData.ts';
import { getBookForLesson } from './knowledgeBase.ts';
import type { AIRequest } from './ai/AIService.ts';
import {
  buildAdaptationsDirective,
  buildGeneratorContext,
  generatorLessonId,
  generatorUnitId,
  getUnitPriorKnowledge,
  resolveGeneratorGrounding,
} from './kbContext.ts';

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
 * Route params that open a generator on an evaluation's own grade/subject
 * scope — the `lessonPickerParams` sibling for callers that hold ids rather
 * than a lesson (the evaluation results and marking screens).
 *
 * The indices are computed against the *same lists the receiving screens
 * rebuild* — bare `getPickerGrades()` / `getPickerSubjects()`. Those two
 * screens used to call `getPickerSubjects(gradeId)`, which only agrees with
 * the receiver's bare call while `INVESTOR_MVP_CURRICULUM` makes the argument
 * a no-op; the day that flag flips, a hand-computed index would open the
 * worksheet on a different subject than the exam it came from.
 *
 * Returns `null` when either id is not in the pickers, so the caller hides
 * the button rather than sending a teacher to material nobody chose.
 */
export function scopePickerParams(
  gradeId: string | null | undefined,
  subjectId: string | null | undefined,
): { gradeIdx: string; subjectIdx: string } | null {
  if (!gradeId || !subjectId) return null;
  const gradeIdx = getPickerGrades().findIndex(g => g.id === gradeId);
  const subjectIdx = getPickerSubjects().findIndex(s => s.id === subjectId);
  if (gradeIdx < 0 || subjectIdx < 0) return null;
  return { gradeIdx: String(gradeIdx), subjectIdx: String(subjectIdx) };
}

/**
 * Picker params inferred from a bare `topic` route param — the last line of
 * defence for navigations that carry a lesson title but no `gradeIdx` /
 * `subjectIdx` (old bookmarked URLs, callers that predate `lessonPickerParams`).
 *
 * Without this, a generator screen opened as `/ai-tools/quiz?topic=<math
 * lesson>` falls back to picker index 0 for both — whatever grade and subject
 * happen to sit there — and generates that lesson under a subject nobody chose
 * (the live model dutifully produced «اختبار في اللغة الإنجليزية» full of math).
 * Grounding the topic recovers the lesson's own book, and the book fixes the
 * grade and the subject.
 *
 * Returns `null` for an empty or ungrounded topic, so the caller keeps the
 * screen's normal defaults.
 */
export function topicPickerParams(
  topic: string | null | undefined,
  lang: 'ar' | 'en',
): { gradeIdx: string; subjectIdx: string } | null {
  const trimmed = topic?.trim();
  if (!trimmed) return null;
  const lesson = resolveGeneratorGrounding(trimmed, lang).lesson;
  if (!lesson) return null;
  const book = getBookForLesson(lesson);
  if (!book) return null;
  return scopePickerParams(book.gradeId, book.subjectId);
}

/**
 * The subject a grounded topic actually belongs to, when it is not the one
 * the teacher's picker shows — `null` when they agree, or when the topic is
 * ungrounded / the lesson's book unknown (nothing to contradict).
 *
 * Generator screens call this before sending a request: a math lesson title
 * under subject «اللغة الإنجليزية» cannot produce an honest paper — the KB
 * serves the lesson's own (math) content while the header claims English — so
 * the screen refuses with the lesson's real subject named instead of
 * generating mislabeled material. Fail closed, or label honestly; never both.
 */
export function groundedSubjectConflict(
  topic: string,
  lang: 'ar' | 'en',
  pickedSubjectId: string,
): Subject | null {
  const trimmed = topic.trim();
  if (!trimmed) return null;
  const lesson = resolveGeneratorGrounding(trimmed, lang).lesson;
  if (!lesson) return null;
  const book = getBookForLesson(lesson);
  if (!book || book.subjectId === pickedSubjectId) return null;
  return getPickerSubjects().find(s => s.id === book.subjectId) ?? null;
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
  /**
   * Free-text notes on prior topics the teacher wants re-explained — from
   * earlier lessons or earlier grades — because some students haven't fully
   * grasped them. Distinct from `adaptations` (delivery instructions).
   */
  priorTopicsNotes?: string;
  /** Prepend the unit's own curriculum "تعلمت سابقًا" concepts, when it has any. */
  includePriorReview?: boolean;
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

  const unitPrior = grounding.lesson ? getUnitPriorKnowledge(grounding.lesson.id) : [];
  const usePrior = Boolean(args.includePriorReview) && unitPrior.length > 0;
  const priorTopicsNotes = args.priorTopicsNotes?.trim() || undefined;

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
      lessonId: grounding.lesson?.id,
      // Adaptations and prior-topic notes are the teacher's own words and end
      // up in the plan verbatim, so a request carrying either is theirs alone.
      // Objectives come from the curriculum context here, not a text box.
      contextSource: (args.adaptations?.trim() || priorTopicsNotes) ? 'teacher' : 'curriculum',
      includePriorReview: usePrior || undefined,
      priorKnowledge: usePrior ? unitPrior : undefined,
      priorTopicsNotes,
    },
  };
}

/**
 * An 8-minute retrieval warm-up aimed at one weak objective, built on that
 * objective's own lesson — the results dashboard's "teach the gap" button.
 *
 * The dashboard holds objective ids and an objective knows its lesson, so the
 * hand-off carries the KB id rather than a title string (a title does not
 * identify a lesson — see CLAUDE.md). The objective text is curriculum text,
 * not something the teacher typed, so the request stays shareable.
 *
 * Returns `null` when the objective or its lesson is unknown, so the caller
 * hides the button rather than generating on a guess.
 */
export function buildGapWarmupRequest(
  objectiveId: string,
  lang: 'ar' | 'en',
): { context: LessonPrepContext; objectiveText: string; request: AIRequest } | null {
  const objective = getObjectiveById(objectiveId);
  const context = objective ? resolveLessonPrepContext(objective.lessonId, lang) : null;
  if (!objective || !context) return null;
  const objectiveText =
    (lang === 'ar' ? objective.descriptionAr : objective.description) || objective.description;
  return {
    context,
    objectiveText,
    request: {
      grade: context.gradeName,
      subject: context.subjectName,
      topic: context.topic,
      language: lang === 'ar' ? 'arabic' : 'english',
      activityType: 'individual',
      duration: 8,
      activityVariant: 'warmup',
      objectives: objectiveText,
      additionalContext: buildGeneratorContext(context.topic, lang),
      unitId: generatorUnitId(context.topic, lang),
      lessonId: generatorLessonId(context.topic, lang),
      contextSource: 'curriculum',
    },
  };
}
