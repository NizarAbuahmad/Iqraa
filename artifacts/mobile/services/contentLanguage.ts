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
import { SUBJECTS, getPickerSubjects } from './curriculumData.ts';

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

/** The subject a saved material was made for: its picker position, else its stored name. */
export function materialSubjectId(
  item: { subject: string; formState?: Record<string, unknown> | null },
): string | undefined {
  const raw = item.formState?.subjectIdx;
  const idx = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : NaN;
  const picked = Number.isInteger(idx) ? getPickerSubjects()[idx]?.id : undefined;
  if (picked) return picked;
  const name = item.subject.trim();
  return SUBJECTS.find(s => s.name.toLowerCase() === name.toLowerCase() || s.nameAr === name)?.id;
}

/**
 * Kinds whose tool screen rebuilds them from the subject, and so can redo them
 * in English. A lesson flow cannot be reopened, and a prompt deck's language
 * follows the teacher's subjects rather than its own.
 */
const REDOABLE_IN_ENGLISH = new Set(['lesson', 'worksheet', 'quiz', 'activity', 'slides']);

/**
 * An English material saved in Arabic — everything prepared for English before
 * 2026-10-04. Opening one redoes it in English over the Arabic copy.
 */
export function isPreEnglishMaterial(
  item: { type: string; language: string; subject: string; formState?: Record<string, unknown> | null },
): boolean {
  return item.language === 'ar' && REDOABLE_IN_ENGLISH.has(item.type) && materialSubjectId(item) === 'english';
}
