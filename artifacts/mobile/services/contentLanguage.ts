/**
 * The language a subject's generated material is written in.
 *
 * English is taught in English: its lesson plans, slides, worksheets and
 * quizzes come out in English whatever language the app's UI is in. Every
 * other subject follows the UI. The screens' own chrome — pickers, buttons,
 * errors — stays in the UI language either way; only the material switches.
 *
 * This replaces the 2026-08-30 rule of bilingual headings over Arabic-UI
 * English decks («مفردات الدرس · Key Vocabulary»): the material is now
 * English end to end, so there is nothing left to gloss.
 */
import type { Lang } from './i18n.ts';
import { resolveGroundedKbLesson, type KbScope } from './knowledgeBase.ts';

export function contentLang(subjectId: string | null | undefined, uiLang: Lang): Lang {
  return subjectId === 'english' ? 'en' : uiLang;
}

/**
 * A topic handed over in one language, restated in another — the lesson's own
 * title when the topic names one, unchanged otherwise.
 *
 * Every hand-off into a generator (home, chat, موادي, lesson pages) passes the
 * lesson title in the UI language, and an English lesson's Arabic-UI title is
 * an Arabic gloss. Generated in English, that gloss would ground nothing and
 * head the material in Arabic.
 */
export function topicInLang(topic: string, from: Lang, to: Lang, scope?: KbScope): string {
  if (from === to || !topic.trim()) return topic;
  const lesson = resolveGroundedKbLesson(topic, from, scope);
  return lesson ? (to === 'ar' ? lesson.titleAr : lesson.titleEn) : topic;
}
