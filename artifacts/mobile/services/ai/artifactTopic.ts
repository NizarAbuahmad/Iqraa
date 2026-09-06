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


/**
 * Arabic accusative tail — the «اً» on «واجباً», «اختباراً», «نشاطاً».
 *
 * The chip prompts are written in natural Arabic, so their nouns arrive
 * inflected while the strip list holds bare stems. Matching the stem alone
 * left the tail behind as its own word: «أنشئ واجباً منزلياً عن: الدائرة»
 * resolved to «اً منزلياً الدائرة». Both orderings of alif and tanwin occur
 * depending on the keyboard, so both are allowed.
 */
const ACC = '[\u064B-\u0652]*\u0627?[\u064B-\u0652]*';

/** Verbs an ask opens with. */
const VERBS = [
  'حضّر', 'حضر', 'جهّز', 'جهز', 'أنشئ', 'انشئ', 'اعمل', 'أعمل', 'ولّد', 'ولد',
  'أعد', 'اعد', 'إعداد', 'اعداد', 'اقترح', 'إقترح', 'أضف', 'اضف',
  'prepare', 'create', 'make', 'generate', 'build', 'suggest', 'write',
];

/** What the ask is asking *for* — the artifact itself. */
const NOUNS = [
  `خطة${ACC}(?:\\s*درس)?`, `ورقة${ACC}(?:\\s*عمل)?`, `اختبار${ACC}`, `واجب${ACC}`,
  `نشاط${ACC}`, `درس${ACC}`, `بطاقة${ACC}(?:\\s*خروج)?`,
  'lesson\\s*plan', 'worksheet', 'quiz', 'homework', 'activity', 'exit\\s*ticket',
];

/**
 * Qualifiers that describe the artifact, not the topic.
 *
 * «ورقة عمل **صفية**» and "a **full** lesson plan" are both about the sheet
 * being asked for. Left in, they became the first word of the material's
 * title and of its first projected slide.
 */
const QUALIFIERS = [
  `كامل${ACC}`, 'كاملة', `صفي${ACC}`, 'صفية', `منزلي${ACC}`, 'منزلية',
  `قصير${ACC}`, 'قصيرة', `سريع${ACC}`, 'سريعة',
  // 'class' on its own is deliberately absent: it strips «Class Management»
  // down to «Management». Bare, it is likelier to be part of a topic than a
  // description of the artifact, and «صفية» / 'in-class' / 'classroom' already
  // cover every phrasing the chips actually send.
  'full', 'complete', 'short', 'quick', 'in-?class', 'classroom',
];

/** Prepositions that introduce the topic, with the colon the chips add. */
const LEAD_IN = ['عن', 'حول', 'بخصوص', 'about', 'for', 'on'];

const STRIP = new RegExp(
  `(^|\\s)(?:${[...VERBS, ...NOUNS, ...QUALIFIERS].join('|')})(?=\\s|$)`,
  'gi',
);
const LEAD_IN_RE = new RegExp(
  `(^|\\s)(?:${LEAD_IN.join('|')})\\s*[:\uFF1A،,]?(?=\\s|$)`,
  'gi',
);

/**
 * The topic an ask is about, with the asking stripped off.
 *
 * Not cosmetic: this string titles the saved material and heads the first
 * slide when the material is projected, so anything left behind is read by a
 * class. Every rule here earned its place by leaking into one — see the
 * chip-prompt cases in the tests, which are the exact strings the product
 * sends when a teacher taps «حضّر خطة الدرس».
 *
 * Removals repeat until they stop finding anything: the parts are written as
 * whole words, and one pass leaves «ورقة عمل صفية» as «صفية» — a qualifier
 * that only becomes a leading word once the noun in front of it is gone.
 */
export function topicFromQuery(query: string): string {
  let out = query;
  for (let pass = 0; pass < 4; pass += 1) {
    const before = out;
    out = out.replace(STRIP, '$1').replace(/\s+/g, ' ').trim();
    if (out === before) break;
  }
  out = out
    .replace(LEAD_IN_RE, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    // A separator that survives at the front introduced the topic; it is
    // never part of it.
    .replace(/^[:\uFF1A،,\-–—]+\s*/, '')
    // English only — Arabic's article is attached (الاقترانات), and cutting
    // the front of that would cut into the word.
    .replace(/^(?:a|an|the)\s+/i, '')
    .trim();
  return out;
}

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

  const stripped = topicFromQuery(query);

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
