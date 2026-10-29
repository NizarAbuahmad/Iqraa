/**
 * What a chip sends when it asks for a teaching material.
 *
 * It appears in the thread as the teacher's own message, so the verb is part of
 * the product's voice: «جهّز» for a material (the word the tool screens' buttons
 * already use), "Create" in English. «أنشئ» is kept for records — an account, a
 * class, an exam, a code. What a teacher TYPES is parsed by `askVocabulary` and
 * `artifactTopic`, which understand every verb; only what the app says is fixed
 * here. `chipVerbs.test.ts` holds both halves.
 *
 * One table, because there were three: the create chips (`lessonCopilot`), the
 * follow-ups under a reply and the lesson card's resource buttons (`iqra.tsx`),
 * each with its own copy of the five sentences and its own choice of verb.
 *
 * Pure, with a type-only import, so `node:test` can load it.
 */
import type { TeachingActionType } from './ai/teachingAssistant.ts';

export const MATERIAL_TYPES: readonly TeachingActionType[] = [
  'lesson-plan',
  'worksheet',
  'quiz',
  'homework',
  'activity',
];

const PROMPTS: Record<TeachingActionType, { ar: (topic: string) => string; en: (topic: string) => string }> = {
  'lesson-plan': {
    ar: t => `جهّز خطة درس كاملة عن: ${t}`,
    en: t => `Create a full lesson plan about: ${t}`,
  },
  worksheet: {
    ar: t => `جهّز ورقة عمل صفية عن: ${t}`,
    en: t => `Create an in-class worksheet about: ${t}`,
  },
  quiz: {
    ar: t => `جهّز اختباراً قصيراً عن: ${t}`,
    en: t => `Create a short quiz about: ${t}`,
  },
  homework: {
    ar: t => `جهّز واجباً منزلياً عن: ${t}`,
    en: t => `Create homework about: ${t}`,
  },
  activity: {
    ar: t => `جهّز نشاطاً صفياً عن: ${t}`,
    en: t => `Create a classroom activity about: ${t}`,
  },
};

/** The message a chip sends to ask for `type` about `topic`. */
export function materialPrompt(type: TeachingActionType, topic: string, lang: 'ar' | 'en'): string {
  return PROMPTS[type][lang](topic);
}
