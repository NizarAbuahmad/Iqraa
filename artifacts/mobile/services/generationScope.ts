/**
 * The scope a material was generated under: grade, subject, topic, lesson.
 *
 * A generator screen's pickers stay editable after a result is on screen, and
 * every screen used to read them again at save, export and present time. So
 * changing the subject (which clears the topic) and pressing Save stored the
 * old paper under the new subject with an empty title, and «اعرض على الشاشة»
 * re-grounded the lesson from whatever the topic box said — the lesson-title
 * trap in CLAUDE.md. The scope is captured once when generation succeeds and,
 * for a reopened material, once from its saved form state; everything that
 * leaves the screen reads it from here.
 *
 * Free of react-native so `node --test` can load it.
 */
import { resolveGeneratorGrounding, type GeneratorGrounding } from './kbContext.ts';
import type { KBLesson } from './knowledgeBase.ts';
import { getPickerGrades, getPickerSubjects } from './curriculumData.ts';

export type GenerationScope = {
  gradeIdx: number;
  subjectIdx: number;
  /** Trimmed. */
  topic: string;
  /** The KB lesson the output was anchored to, resolved once; null when ungrounded. */
  lesson: KBLesson | null;
  grounded: boolean;
};

type FormScope = { gradeIdx: number; subjectIdx: number; topic: string };

/** Freeze the form and the grounding that a generation just used. */
export function captureGenerationScope(
  form: FormScope,
  grounding: Pick<GeneratorGrounding, 'lesson' | 'grounded'>,
): GenerationScope {
  return {
    gradeIdx: form.gradeIdx,
    subjectIdx: form.subjectIdx,
    topic: form.topic.trim(),
    lesson: grounding.lesson,
    grounded: grounding.grounded,
  };
}

/**
 * The scope of a material reopened from موادي: its saved pickers, and its
 * saved topic grounded again so the lesson (and the grounding notice, the
 * book figures, the Ministry form's unit) come back with it. Null when the
 * saved state carries no topic, in which case the screen has nothing better
 * than its live form.
 */
export function reopenedGenerationScope(
  saved: Pick<FormScope, 'gradeIdx' | 'subjectIdx'>,
  topic: string | undefined,
  lang: 'ar' | 'en',
): GenerationScope | null {
  const trimmed = topic?.trim();
  if (!trimmed) return null;
  // The saved pickers say which book this title meant — without them a
  // reopened Grade 9 «النسب المثلثية» worksheet came back with Grade 10
  // figures and unit.
  const scope = {
    gradeId: getPickerGrades()[saved.gradeIdx]?.id,
    subjectId: getPickerSubjects()[saved.subjectIdx]?.id,
  };
  return captureGenerationScope(
    { gradeIdx: saved.gradeIdx, subjectIdx: saved.subjectIdx, topic: trimmed },
    resolveGeneratorGrounding(trimmed, lang, { scope }),
  );
}

/**
 * What to save, export or present: the generation-time scope when there is
 * one, else the live form, ungrounded — honest for a screen that has not
 * generated anything yet.
 */
export function materialScope(generated: GenerationScope | null, form: FormScope): GenerationScope {
  if (generated) return generated;
  return { gradeIdx: form.gradeIdx, subjectIdx: form.subjectIdx, topic: form.topic.trim(), lesson: null, grounded: false };
}
