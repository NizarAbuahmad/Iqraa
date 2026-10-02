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
  generatorFigureCount,
  generatorLessonId,
  generatorUnitId,
  getUnitPriorKnowledge,
  resolveGeneratorGrounding,
  type GeneratorGrounding,
} from './kbContext.ts';

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
    unitId: generatorUnitId(topic, form.lang),
    lessonId: generatorLessonId(topic, form.lang),
    bookFigureCount: generatorFigureCount(topic, form.lang),
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
export function groundLessonPlanTopic(form: Pick<LessonPlanForm, 'topic' | 'lang' | 'objectives'>) {
  return resolveGeneratorGrounding(form.topic.trim(), form.lang, {
    teacherObjectives: form.objectives.trim() || undefined,
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
    unitId: generatorUnitId(topic, form.lang),
    lessonId: generatorLessonId(topic, form.lang),
    bookFigureCount: generatorFigureCount(topic, form.lang),
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
    unitId: generatorUnitId(topic, form.lang),
    lessonId: generatorLessonId(topic, form.lang),
    bookFigureCount: generatorFigureCount(topic, form.lang),
    // A typed objective is the teacher's own words, and they end up inside
    // the generated activity — so that request is theirs alone and never
    // enters the shared pool. Picking a lesson and generating does.
    contextSource: objective ? 'teacher' as const : 'curriculum' as const,
    ...regenerationFields(form.regenerate === true, form.previous),
  };
}
