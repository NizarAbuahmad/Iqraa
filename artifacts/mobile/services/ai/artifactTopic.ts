/**
 * Which topic a chat-generated material is about.
 *
 * Pure string work, split out of `chatArtifacts.ts` so it can be tested: that
 * module constructs the AI client at import time, which `node:test` cannot
 * load. The result is not just a generator input — it titles the saved
 * material and heads the first slide when the material is projected, so a
 * stray preposition ends up on a classroom wall.
 */
import type { KBLesson } from '../knowledgeBase.ts';

/** Resolve topic string for generation from lesson / docs / query. */
export function resolveArtifactTopic(opts: {
  lang: 'ar' | 'en';
  query: string;
  lesson: KBLesson | null;
  activeTopicAr: string | null;
  activeTopicEn: string | null;
  docTopic?: string | null;
  /** When true, uploaded materials beat a soft-pinned curriculum lesson. */
  preferDocuments?: boolean;
}): string {
  const {
    lang,
    query,
    lesson,
    activeTopicAr,
    activeTopicEn,
    docTopic,
    preferDocuments = false,
  } = opts;

  if (preferDocuments && docTopic?.trim()) return docTopic.trim();

  // Explicit topic left in the query after stripping artifact verbs
  // Include حضر/جهز without shadda — teachers often type without tashkeel.
  const stripped = query
    .replace(
      /خطة(\s*درس)?|ورقة(\s*عمل)?|اختبار(\s*قصير)?|واجب(\s*منزلي)?|نشاط(\s*صفي)?|lesson\s*plan|worksheet|quiz|homework|activity|أنشئ|انشئ|ولّد|ولد|اعمل|أعمل|حضّ?ر|جهز|جهّز|أعد|اعد|إعداد|اعداد|كاملة|كامل|prepare|create|make|generate|build/gi,
      ' ',
    )
    // Drop the preposition the ask leaves behind — «خطة درس **عن** الاقترانات».
    //
    // Two bugs lived in the previous pair of replaces, and they cancelled into
    // "Arabic topics keep their عن":
    //  - the `^` anchor ran while the string still began with the spaces the
    //    verb strip had just left, so it never matched;
    //  - `\b` is defined by [A-Za-z0-9_], so `\bعن\b` cannot match between two
    //    Arabic letters — that rule only ever fired for `about` / `for`.
    // Whitespace is collapsed first, and the token test is written against
    // spaces and string ends instead of `\b`, so both scripts behave the same.
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(^|\s)(?:عن|حول|about|for)(?=\s|$)/gi, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    // "prepare a lesson plan about function composition" left "a function
    // composition" as the title. English only — Arabic's article is attached
    // (الاقترانات), and stripping anything off the front of that would cut
    // into the word.
    .replace(/^(?:a|an|the)\s+/i, '');

  // Prefer an explicit topic in the message over soft-pinned / default lesson
  if (stripped && stripped.length >= 3) {
    const lessonTitle = lesson
      ? (lang === 'ar' ? lesson.titleAr : lesson.titleEn)
      : '';
    const looksLikeBareVerbOnly = /^(حضّ?ر|أنشئ|جهز|أعد|prepare|create)$/i.test(stripped);
    if (!looksLikeBareVerbOnly && stripped !== lessonTitle) {
      return stripped;
    }
  }

  if (docTopic?.trim()) return docTopic.trim();
  if (lesson) return lang === 'ar' ? lesson.titleAr : lesson.titleEn;
  if (lang === 'ar' && activeTopicAr) return activeTopicAr;
  if (lang === 'en' && activeTopicEn) return activeTopicEn;
  return stripped || query.trim();
}
