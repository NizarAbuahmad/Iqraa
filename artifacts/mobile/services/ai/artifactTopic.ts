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
  '[اإ]نفو[جغك]رافي[كك]', 'ملخص\\s*بصري',
  'lesson\\s*plan', 'worksheet', 'quiz', 'homework', 'activity', 'exit\\s*ticket',
  'infographic', 'visual\\s*summary',
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
 * A grade or audience the ask names. It is scope, not topic — `extractQueryGradeId` reads
 * it separately — and left in, "a quiz for grade 7" was titled «grade 7».
 */
const SCOPE_PHRASE_RE = new RegExp(
  [
    '(?:for\\s+)?grade\\s*(?:\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)',
    '(?:for\\s+)?(?:\\d{1,2}(?:st|nd|rd|th)?|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)\\s+grade',
    '(?:ال|لل)صف\\s*ال[^\\s]+(?:\\s*عشر)?',
    // The audience, same reason. A phrase only: bare 'class' is often the
    // topic («Class Management»), see QUALIFIERS.
    '(?:for\\s+)?(?:my|our|the)\\s+(?:class|students|kids)',
  ].map(p => `(^|\\s)${p}(?=\\s|$)`).join('|'),
  'gi',
);

/**
 * Words that ask politely but name nothing. Trimmed from the edges only, never
 * the middle, so a topic that contains one («Vitamin A») keeps it. Without
 * this, "make me a quiz" resolved to the topic «me a» and beat the lesson the
 * teacher had picked.
 */
const EDGE_FILLER = new Set([
  'me', 'us', 'a', 'an', 'the', 'some', 'please', 'pls', 'can', 'could', 'would',
  'will', 'you', 'i', 'need', 'want', 'give', 'get', 'just', 'my', 'our', 'to',
  'now', 'thanks', 'another', 'new', 'one',
  'لي', 'لنا', 'أريد', 'اريد', 'أبغى', 'ابغى', 'بدي', 'بدنا', 'ممكن', 'من', 'فضلك',
  'لو', 'سمحت', 'أعطني', 'اعطني', 'عطيني', 'هات', 'الرجاء', 'رجاء', 'رجاءً',
  'جديد', 'جديدة', 'آخر', 'أخرى', 'اخرى', 'لطلابي', 'لصفي', 'للطلاب', 'الآن', 'الان',
]);

function trimEdgeFiller(s: string): string {
  const words = s.split(' ').filter(Boolean);
  while (words.length && EDGE_FILLER.has(words[0]!.toLowerCase())) words.shift();
  // Case-sensitive at the end: a capital there is a name («Vitamin A»), while
  // at the start it is only the sentence case of "Can you…".
  while (words.length && EDGE_FILLER.has(words[words.length - 1]!)) words.pop();
  return words.join(' ');
}

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
  // Trailing «؟» / "?" glued to the last word hid it from the whole-word strip
  // («خطة درس؟» left «درس؟»).
  let out = query.replace(/[?؟!.]+/g, ' ').replace(SCOPE_PHRASE_RE, '$1');
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
  return trimEdgeFiller(out);
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
