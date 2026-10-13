/**
 * The request bodies the worksheet, lesson-plan and activity screens send.
 *
 * They live here, not in the screens, so that `scripts/pregenerate.ts` can
 * build the exact same body a teacher's phone builds. The server reuses a
 * stored artifact only when the whole request hashes the same (see
 * `artifacts/api-server/src/lib/generationKey.ts`), so a script that assembled
 * its own body would fill the pool with copies nobody is ever served.
 * Screens and script call these; do not rebuild a body anywhere else.
 */
import type { AIRequest } from './ai/AIService.ts';
import { regenerationFields } from './ai/regeneration.ts';
import {
  buildAdaptationsDirective,
  figureCountForLesson,
  getUnitPriorKnowledge,
  nccdUnitId,
  resolveGeneratorGrounding,
  type GeneratorGrounding,
} from './kbContext.ts';
import type { KbScope } from './knowledgeBase.ts';

type Lang = 'ar' | 'en';

export type WorksheetForm = {
  gradeName: string;
  /** English subject name — the string the generators branch on. */
  subjectName: string;
  topic: string;
  lang: Lang;
  difficulty: NonNullable<AIRequest['difficulty']>;
  numQuestions: number;
  questionTypes: NonNullable<AIRequest['questionTypes']>;
  includePriorReview: boolean;
  regenerate?: boolean;
  previous?: unknown;
};

export function buildWorksheetRequest(form: WorksheetForm, grounding: GeneratorGrounding): AIRequest {
  const topic = form.topic.trim();
  const unitPrior = grounding.lesson ? getUnitPriorKnowledge(grounding.lesson.id) : [];
  const usePrior = form.includePriorReview && unitPrior.length > 0;
  return {
    // Localised: this string is carried into generated content verbatim —
    // the Arabic worksheet header printed «الصف: Grade 10». `grade` is never
    // compared anywhere, only displayed and passed through, so translating it
    // is safe. `subject` is deliberately left in English: it feeds
    // isMathContext and ~30 other call sites.
    grade: form.gradeName,
    subject: form.subjectName,
    topic,
    language: (form.lang === 'ar' ? 'arabic' : 'english') as 'arabic' | 'english',
    difficulty: form.difficulty,
    numQuestions: form.numQuestions,
    questionTypes: form.questionTypes,
    additionalContext: (grounding.grounded ? grounding.context : grounding.ungroundedNote) || undefined,
    // From the grounding the screen resolved (in its picked scope), not
    // re-derived from the title — a title shared across books resolved to
    // another grade's lesson id here while the context above was right.
    unitId: nccdUnitId(grounding.lesson?.unitId),
    lessonId: grounding.lesson?.id,
    bookFigureCount: figureCountForLesson(grounding.lesson?.id),
    contextSource: 'curriculum' as const,
    ...regenerationFields(form.regenerate === true, form.previous),
    includePriorReview: usePrior,
    priorKnowledge: usePrior ? unitPrior : undefined,
  };
}

export type LessonPlanForm = {
  gradeName: string;
  subjectName: string;
  topic: string;
  lang: Lang;
  durationMinutes: number;
  teachingStyle: 'direct' | 'inquiry' | 'collaborative';
  objectives: string;
  adaptations: string;
  priorTopicsNotes: string;
  includePriorReview: boolean;
  regenerate?: boolean;
  previous?: unknown;
};

/** Grounds the topic itself; the screen needs the grounding back for its notice. */
export function groundLessonPlanTopic(
  form: Pick<LessonPlanForm, 'topic' | 'lang' | 'objectives'>,
  scope?: KbScope,
) {
  return resolveGeneratorGrounding(form.topic.trim(), form.lang, {
    teacherObjectives: form.objectives.trim() || undefined,
    scope,
  });
}

export function buildLessonPlanRequest(form: LessonPlanForm, grounding: GeneratorGrounding): AIRequest {
  const topic = form.topic.trim();
  const additionalContext = [
    grounding.grounded ? grounding.context : grounding.ungroundedNote,
    buildAdaptationsDirective(form.adaptations, form.lang),
  ].filter(Boolean).join('\n') || undefined;
  const unitPrior = grounding.lesson ? getUnitPriorKnowledge(grounding.lesson.id) : [];
  const usePrior = form.includePriorReview && unitPrior.length > 0;
  return {
    grade: form.gradeName,
    subject: form.subjectName,
    topic,
    duration: form.durationMinutes,
    language: form.lang === 'ar' ? 'arabic' : 'english',
    teachingStyle: form.teachingStyle,
    objectives: form.objectives.trim() || undefined,
    additionalContext,
    // From the grounding the screen resolved (in its picked scope), not
    // re-derived from the title — a title shared across books resolved to
    // another grade's lesson id here while the context above was right.
    unitId: nccdUnitId(grounding.lesson?.unitId),
    lessonId: grounding.lesson?.id,
    bookFigureCount: figureCountForLesson(grounding.lesson?.id),
    // Objectives, adaptations and prior-topic notes are all free text the
    // teacher typed, and all three are carried into the plan verbatim. A
    // plan built from any of them is that teacher's and is never pooled;
    // a plan built from the lesson alone is everybody's.
    contextSource: (form.objectives.trim() || form.adaptations.trim() || form.priorTopicsNotes.trim())
      ? 'teacher' as const
      : 'curriculum' as const,
    ...regenerationFields(form.regenerate === true, form.previous),
    includePriorReview: usePrior || undefined,
    priorKnowledge: usePrior ? unitPrior : undefined,
    priorTopicsNotes: form.priorTopicsNotes.trim() || undefined,
    // The Ministry form needs a learner role per stage. Asked for in the same
    // call as the plan, so the roles match what the teacher reads — exporting
    // later would mean a second generation that no longer does. Part of the
    // strict cache key, and `pregenerate.ts` builds through here, so the pooled
    // plan and the one this screen asks for are the same artifact.
    ministryRoles: true,
  };
}

export type LessonTeachingForm = {
  /** Localised grade name — display-only, carried into the content verbatim. */
  gradeName: string;
  /** English subject name — the string the generators branch on. */
  subjectName: string;
  topic: string;
  lang: Lang;
};

/**
 * The `/generate/lesson-teaching` body: the explanation section of a Slides
 * Maker deck, which the student lesson page reads back from the pool.
 *
 * Extracted from `slides.tsx`, which built this inline. It must send what that
 * code sent, so explanations teachers have already stored keep matching.
 * `lessonTeachingRequest.test.ts` pins that for the Arabic, grounded, grade 10
 * Mathematics path only (deep-equal to a copy of the old inline body); the
 * English and ungrounded paths match by construction (the same fields, read
 * from `slides.tsx` before the extraction), not by a test. The lesson id comes
 * from the grounding the caller already resolved, not from the title.
 */
export function buildLessonTeachingRequest(
  form: LessonTeachingForm,
  grounding: GeneratorGrounding,
  regen: ReturnType<typeof regenerationFields> = {},
): AIRequest {
  return {
    grade: form.gradeName,
    subject: form.subjectName,
    topic: form.topic.trim(),
    language: form.lang === 'ar' ? 'arabic' : 'english',
    additionalContext: grounding.grounded ? grounding.context : grounding.ungroundedNote,
    unitId: nccdUnitId(grounding.lesson?.unitId),
    lessonId: grounding.lesson?.id,
    contextSource: 'curriculum' as const,
    ...regen,
  };
}

export type ActivityForm = {
  /** Localised grade name — display-only, carried into the content verbatim. */
  gradeName: string;
  /** English subject name — the string the generators branch on. */
  subjectName: string;
  topic: string;
  lang: Lang;
  activityType: NonNullable<AIRequest['activityType']>;
  durationMinutes: number;
  /** The teacher's own objective, free text; empty when none was typed. */
  objective: string;
  regenerate?: boolean;
  previous?: unknown;
};

export function buildActivityRequest(form: ActivityForm, grounding: GeneratorGrounding): AIRequest {
  const topic = form.topic.trim();
  const objective = form.objective.trim();
  return {
    grade: form.gradeName,
    subject: form.subjectName,
    topic,
    language: form.lang === 'ar' ? 'arabic' : 'english',
    activityType: form.activityType,
    duration: form.durationMinutes,
    objectives: objective || undefined,
    additionalContext: (grounding.grounded ? grounding.context : grounding.ungroundedNote) || undefined,
    // From the grounding the screen resolved (in its picked scope), not
    // re-derived from the title — a title shared across books resolved to
    // another grade's lesson id here while the context above was right.
    unitId: nccdUnitId(grounding.lesson?.unitId),
    lessonId: grounding.lesson?.id,
    bookFigureCount: figureCountForLesson(grounding.lesson?.id),
    // A typed objective is the teacher's own words, and they end up inside
    // the generated activity — so that request is theirs alone and never
    // enters the shared pool. Picking a lesson and generating does.
    contextSource: objective ? 'teacher' as const : 'curriculum' as const,
    ...regenerationFields(form.regenerate === true, form.previous),
  };
}
