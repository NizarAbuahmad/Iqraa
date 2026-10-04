/**
 * Lean lesson-centric helpers for the IQRA chat MVP.
 * No workspace layer — builds on ChatSessionMemory + session documents.
 */

import {
  hasGeneratedResource,
  isReferentialQuery,
  resolveCurriculumContext,
  type ChatSessionMemory,
  type LessonPinStrength,
  type SessionArtifact,
} from './ai/teachingAssistant.ts';
import { DEMO_CONTINUE } from './continueTeaching.ts';
import { stripScopePhrases, topicFromQuery } from './ai/artifactTopic.ts';
import { artifactFromAsk, isBareTeachAsk } from './ai/askVocabulary.ts';
import { isStandaloneTurn } from './ai/intentRouter.ts';
import {
  getBookForLesson,
  getLessonById,
  isConfidentKbHit,
  KB_CONFIDENT_SCORE,
  searchKBSemantic,
  type KBLesson,
  type KBScoredLesson,
} from './knowledgeBase.ts';
import { getPickerSubjects } from './curriculumData.ts';
import type { SessionDocument } from './documents/index.ts';

export { isConfidentKbHit, KB_CONFIDENT_SCORE };

/** KB lesson id used as the investor-MVP default active lesson. */
export const DEFAULT_ACTIVE_LESSON_ID = 'kbl-math-s2-nccd-u5_l3'; // تركيب الاقترانات (NCCD S2)

export type LessonSuggestion = {
  id: string;
  emoji: string;
  labelAr: string;
  labelEn: string;
  promptAr: string;
  promptEn: string;
  toolType?: SessionArtifact;
  lessonId?: string;
};

export type ResourceChip = {
  type: SessionArtifact;
  emoji: string;
  labelAr: string;
  labelEn: string;
  done: boolean;
};

const RESOURCE_META: {
  type: SessionArtifact;
  emoji: string;
  labelAr: string;
  labelEn: string;
}[] = [
  { type: 'lesson-plan', emoji: '📘', labelAr: 'خطة درس', labelEn: 'Lesson plan' },
  { type: 'activity', emoji: '🎯', labelAr: 'نشاط', labelEn: 'Activity' },
  { type: 'worksheet', emoji: '📝', labelAr: 'ورقة عمل', labelEn: 'Worksheet' },
  { type: 'quiz', emoji: '✅', labelAr: 'اختبار', labelEn: 'Quiz' },
  { type: 'homework', emoji: '🏠', labelAr: 'واجب', labelEn: 'Homework' },
];

/** Resolve the active KB lesson for the lesson card (soft or hard pin). */
export function resolveActiveLesson(memory: ChatSessionMemory): KBLesson | null {
  if (memory.activeLessonId) {
    const hit = getLessonById(memory.activeLessonId);
    if (hit) return hit;
  }
  return null;
}

/**
 * The lesson behind a change-lesson pick.
 *
 * The picker knows exactly which lesson was tapped, so use its id. Searching
 * the KB for the title instead is not equivalent: for 16 of the picker's 63
 * lessons the top semantic hit is a *different* lesson (choosing «قانون
 * الجيوب» pinned «قانون جيب التمام», «حسابات الطاقة في التفاعلات الكيميائية»
 * pinned «تغيرات الطاقة في التفاعلات الكيميائية»), and the whole session —
 * the lesson card, chat retrieval, «ابدأ الحصة» — then followed a lesson the
 * teacher never chose.
 *
 * The search stays as the fallback for what has no id: entire-unit and
 * entire-book picks, and free-typed topics.
 */
export function resolvePickedLesson(
  topic: string,
  pick: { lessonId?: string | null } | undefined,
  lang: 'ar' | 'en',
): KBLesson | null {
  if (pick?.lessonId) {
    const exact = getLessonById(pick.lessonId);
    if (exact) return exact;
  }
  const query = topic.trim();
  if (!query) return null;
  return searchKBSemantic(query, lang)[0] ?? null;
}

/** Soft-seed the demo default lesson for the card — does not hard-pin retrieval. */
export function seedDefaultLessonMemory(base?: ChatSessionMemory): ChatSessionMemory {
  const start = base ?? {
    activeLessonId: null,
    activeTopicAr: null,
    activeTopicEn: null,
    lessonPin: 'none' as LessonPinStrength,
    recentQueries: [],
    discussedArtifacts: [],
    generatedResources: [],
    lastGeneratedResource: null,
    lastIntent: null,
    clarifiedLessonIds: [],
    prepLessonId: null,
    prepCompleted: [],
    lastCompletedPrepStep: null,
  };
  const lesson = getLessonById(start.activeLessonId ?? DEFAULT_ACTIVE_LESSON_ID)
    ?? getLessonById(DEFAULT_ACTIVE_LESSON_ID);
  if (!lesson) return { ...start, lessonPin: start.lessonPin ?? 'none' };
  return {
    ...start,
    activeLessonId: lesson.id,
    activeTopicAr: lesson.titleAr,
    activeTopicEn: lesson.titleEn,
    lessonPin: start.lessonPin === 'hard' ? 'hard' : 'soft',
    prepLessonId: start.prepLessonId ?? lesson.id,
    generatedResources: start.generatedResources ?? [],
    lastGeneratedResource: start.lastGeneratedResource ?? null,
  };
}

/**
 * An ask that names no topic of its own — "خطة", "make me a quiz", «اعمل لي
 * اختبار» — so it is about the lesson already picked. It used to be a fixed
 * list of bare nouns, so any polite wording («بدي اختبار») lost the picked
 * lesson. A named grade is scope, not topic; `shouldReuseActiveLesson` checks
 * it against the pinned lesson's grade separately.
 */
export function isBareArtifactShortcut(query: string): boolean {
  return topicFromQuery(query) === '';
}

/**
 * The topic a teacher names when they say they are leaving the current lesson
 * («خلينا نتكلم عن الأحياء», "can we now talk about biology"), or `null` when
 * the message is not a switch. An empty string is a switch with no named
 * target ("something else") — still a switch, so the caller searches nothing
 * rather than snapping back to the pinned lesson.
 *
 * Without this, a hard-pinned lesson plus a sentence the keyword search cannot
 * score («biology» against Arabic titles) forced the old lesson back into the
 * reply, opened with «لنربط الإجابة بدرسك الحالي», and the teacher could not
 * change subject by typing.
 */
export function topicSwitchTarget(query: string): string | null {
  const q = query.trim().replace(/[!?؟.،,]+$/g, '').trim();
  const patterns: RegExp[] = [
    /^(?:(?:can|could|shall|may) we |let'?s |now |please )*(?:now )?(?:talk|speak|chat|move on|move|switch|go|jump)(?: on)? (?:about|to|over to|on to) (.+)$/i,
    /^(?:please |now |let'?s )*(?:change|switch) (?:the )?(?:lesson|topic|subject)(?: to (.+))?$/i,
    /^(?:another|a different|new) (?:lesson|topic|subject)(?:[:،]? *(.+))?$/i,
    /^(?:هل |طيب |طب |ممكن |يمكن |بدي |بدنا |أريد |اريد |نقدر |خلينا |خلّينا |دعنا |هيا |تعال |الآن |الان )*(?:أن |ان )?(?:نتكلم|نتحدث|نحكي|نحكى|نتناقش|أتكلم|اتكلم|نتحول|ننتقل|انتقل|نروح|نرجع)(?: الآن| الان| هلأ| هلق)? (?:عن|إلى|الى|على|ل) ?(.+)$/,
    /^(?:هل |طيب |طب |ممكن |يمكن |بدي |بدنا |أريد |اريد |خلينا |خلّينا |دعنا |الآن |الان )*(?:غيّر|غير|بدّل|بدل|نغيّر|نغير|نبدّل|نبدل)(?: لي| لنا)? (?:الدرس|الموضوع|المادة|الحصة)(?: (?:إلى|الى|ل) ?(.+))?$/,
    /^(?:درس|موضوع|مادة|حصة) (?:آخر|أخرى|اخرى|ثاني|ثانية|جديد|جديدة|مختلف|مختلفة)(?:[:،]? *(.+))?$/,
  ];
  for (const p of patterns) {
    const m = q.match(p);
    if (!m) continue;
    const target = (m[1] ?? '')
      .replace(/\b(?:now|instead|please|again)\b/gi, '')
      .replace(/(?:^|\s)(?:الآن|الان|هلأ|هلق|لو سمحت|من فضلك|بدل ذلك)(?=\s|$)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // «نتكلم عن هذا الدرس» / "talk about the same lesson" is staying, not leaving.
    // No `\b` — it is ASCII-only in JS and never matches next to Arabic letters.
    if (/^(?:هذا|هذه|نفس|ذات|this|that|the same|same|our|the current|it)(?:\s|$)/i.test(target)) return null;
    if (/^(?:something|anything|شيء|شي|أمر|موضوع) (?:else|آخر|اخر|ثاني)$/i.test(target)) return '';
    return target;
  }
  return null;
}

const GRADE_WORDS_EN: Array<[cardinal: string, ordinal: string]> = [
  ['one', 'first'], ['two', 'second'], ['three', 'third'], ['four', 'fourth'],
  ['five', 'fifth'], ['six', 'sixth'], ['seven', 'seventh'], ['eight', 'eighth'],
  ['nine', 'ninth'], ['ten', 'tenth'], ['eleven', 'eleventh'], ['twelve', 'twelfth'],
];

/**
 * «الصف الثاني» is a prefix of «الصف الثاني عشر» (2 vs 12), same for the
 * absence of a standalone «الصف الحادي» (11 only exists as "حادي عشر"). The
 * negative lookahead keeps grade 2 from matching inside grade 12's name.
 * JS `\b` is ASCII-only and never matches next to Arabic letters (see
 * `topicSwitchTarget` above), so these rely on the lookahead instead.
 */
// «لـ + الصف» is written «للصف» (the alef drops), and "for grade N" is the
// commonest way a teacher names a grade — so it must match as well as «الصف».
const SAFF = '(?:ال|لل)صف\\s*';
const GRADE_PATTERNS_AR: Array<[gradeId: string, pattern: RegExp]> = [
  ['grade-1', new RegExp(`${SAFF}ال(?:أ|ا)ول`)],
  ['grade-2', new RegExp(`${SAFF}الثاني(?!\\s*عشر)`)],
  ['grade-3', new RegExp(`${SAFF}الثالث`)],
  ['grade-4', new RegExp(`${SAFF}الرابع`)],
  ['grade-5', new RegExp(`${SAFF}الخامس`)],
  ['grade-6', new RegExp(`${SAFF}السادس`)],
  ['grade-7', new RegExp(`${SAFF}السابع`)],
  ['grade-8', new RegExp(`${SAFF}الثامن`)],
  ['grade-9', new RegExp(`${SAFF}التاسع`)],
  ['grade-10', new RegExp(`${SAFF}العاشر`)],
  ['grade-11', new RegExp(`${SAFF}الحادي\\s*عشر`)],
  ['grade-12', new RegExp(`${SAFF}الثاني\\s*عشر`)],
];

/**
 * The grade id ("grade-1" .. "grade-12") when the teacher names one explicitly
 * — "grade one", "grade 1", "1st grade", «الصف الأول» — or null.
 *
 * Reported from app.iqrra.com on 2026-09-24: a chat message naming "grade one"
 * was answered against whatever grade the top-right lesson picker happened to
 * have pinned (grade 10, by default), because nothing ever read a grade out of
 * the free-text query. This is the read side of that fix — see its callers in
 * iqra.tsx for where a named grade now overrides the pinned/active lesson.
 */
export function extractQueryGradeId(query: string): string | null {
  const q = query.trim();
  if (!q) return null;

  const numeric = q.match(/\bgrade\s*(\d{1,2})\b/i) ?? q.match(/\b(\d{1,2})\s*(?:st|nd|rd|th)?\s*grade\b/i);
  if (numeric) {
    const n = Number(numeric[1]);
    if (n >= 1 && n <= 12) return `grade-${n}`;
  }

  for (let i = 0; i < GRADE_WORDS_EN.length; i++) {
    const [cardinal, ordinal] = GRADE_WORDS_EN[i]!;
    if (new RegExp(`\\bgrade\\s+${cardinal}\\b|\\b${ordinal}\\s+grade\\b`, 'i').test(q)) {
      return `grade-${i + 1}`;
    }
  }

  for (const [gradeId, pattern] of GRADE_PATTERNS_AR) {
    if (pattern.test(q)) return gradeId;
  }

  return null;
}

/**
 * Subject names a teacher types, keyed by KB subject id. Arabic stems take an
 * optional article and a one-letter preposition («للعلوم», «بالإنجليزي»).
 * More specific subjects come first: «العلوم الحياتية» is biology, not science.
 */
const SUBJECT_PATTERNS: Array<[subjectId: string, en: string, ar: string]> = [
  ['biology', 'biology', 'العلوم\\s*الحياتية|أحياء|احياء'],
  ['earth-science', 'earth\\s*science|geology', 'علوم\\s*الأرض|علوم\\s*الارض'],
  ['financial-literacy', 'financial\\s*(?:literacy|culture)', 'الثقافة\\s*المالية'],
  ['english', 'english', 'إنجليزي[ةه]?|انجليزي[ةه]?|إنكليزي[ةه]?|انكليزي[ةه]?'],
  ['arabic', 'arabic', 'عربي[ةه]?|لغتنا\\s*الجميلة'],
  ['mathematics', 'maths?|mathematics', 'رياضيات'],
  ['chemistry', 'chemistry', 'كيمياء'],
  ['physics', 'physics', 'فيزياء'],
  ['science', 'science', 'علوم'],
  ['islamic', 'islamic(?:\\s*(?:studies|education))?|religion', 'تربية\\s*إسلامية|تربية\\s*اسلامية|إسلامية|اسلامية|دين'],
  ['social', 'social\\s*studies', 'اجتماعيات|دراسات\\s*اجتماعية'],
  ['history', 'history', 'تاريخ'],
  ['geography', 'geography', 'جغرافيا'],
  ['digital-literacy', 'computer|digital\\s*skills', 'حاسوب|مهارات\\s*رقمية'],
  ['physical-education', 'p\\.?e\\.?|physical\\s*education|sports?', 'تربية\\s*رياضية|رياضة'],
  ['creative-arts', 'art|arts|music', 'فنون|تربية\\s*فنية|موسيقى'],
];

// Arabic word edges by hand: JS `\b` is ASCII-only, so the old «\bالكيمياء\b»
// never matched anything.
const AR_BEFORE = '(?<![\\u0621-\\u064A])(?:[وبلف]|لل|بال|وال)?(?:ال)?';
const AR_AFTER = '(?![\\u0621-\\u064A])';

/**
 * The KB subject id when the teacher names a subject — "english", «العلوم»,
 * «للرياضيات» — or null. The chat only knew chemistry and maths (and not even
 * those in Arabic), so "i need a study plan for english" was searched as free
 * text, "need" matched «الحاجات» in grade 7 financial literacy, and that is
 * what the teacher got.
 */
export function extractQuerySubjectId(query: string): string | null {
  const q = query.trim();
  if (!q) return null;
  for (const [id, en, ar] of SUBJECT_PATTERNS) {
    if (new RegExp(`\\b(?:${en})\\b`, 'i').test(q)) return id;
    if (new RegExp(`${AR_BEFORE}(?:${ar})${AR_AFTER}`).test(q)) return id;
  }
  return null;
}

/** `query` with every subject name removed — the subject is scope, not topic. */
export function stripSubjectNames(query: string): string {
  let out = query;
  for (const [, en, ar] of SUBJECT_PATTERNS) {
    out = out
      .replace(new RegExp(`\\b(?:${en})\\b`, 'gi'), ' ')
      .replace(new RegExp(`${AR_BEFORE}(?:${ar})${AR_AFTER}`, 'g'), ' ');
  }
  // What introduced the subject is left dangling at the edges once it goes:
  // «للغة الإنجليزية» leaves «للغة», «في العلوم» leaves «في».
  const words = out.split(/\s+/).filter(Boolean);
  const dangling = /^(?:في|فى|لغة|اللغة|للغة|بلغة|مادة|المادة|لمادة|in|for|subject|the|class)$/i;
  while (words.length && dangling.test(words[0]!)) words.shift();
  while (words.length && dangling.test(words[words.length - 1]!)) words.pop();
  return words.join(' ');
}

const ORDINALS: Array<[n: number, words: string]> = [
  [1, 'الأول|الاول|أول|اول|الأولى|الاولى|first|one|1|١'],
  [2, 'الثاني|ثاني|الثانية|second|two|2|٢'],
  [3, 'الثالث|ثالث|الثالثة|third|three|3|٣'],
  [4, 'الرابع|رابع|الرابعة|fourth|four|4|٤'],
  [5, 'الخامس|خامس|الخامسة|fifth|five|5|٥'],
];

/**
 * Which offered option a bare ordinal picks — «الثاني», "the 2nd one", «٣» —
 * or null. Answering «أي درس…؟» with «الثاني» meant the second lesson shown;
 * it was read as a message of its own and got «وضّح لي أكثر».
 */
export function ordinalChoice(reply: string): number | null {
  const q = reply.trim()
    .replace(/[.!؟?]+$/, '')
    .replace(/^(?:the|رقم|الدرس|درس|lesson|option)\s+/i, '')
    .replace(/\s+(?:one|منهم|منها|please|لو\s*سمحت)$/i, '')
    .replace(/(?<=\d)(?:st|nd|rd|th)$/i, '')
    .trim();
  for (const [n, words] of ORDINALS) {
    if (new RegExp(`^(?:${words})$`, 'i').test(q)) return n;
  }
  return null;
}

/**
 * The message to act on when the teacher answers a question the chat asked.
 *
 * The chat asked «أي درس من اللغة العربية للصف الرابع؟» after «حضّر خطة
 * الدرس للعربي»; the teacher answered «الصف العاشر», and that answer was read
 * as a new message on its own — no ask, no subject — so the chat asked
 * «وضّح لي أكثر» and the lesson plan was lost. A reply that only narrows the
 * pending ask (a grade, a lesson title, the same subject) now joins it; one
 * that makes a new ask with its own topic, switches topic, or names another
 * subject stands alone.
 */
export function mergeScopeReply(pending: string | null, reply: string): string {
  const r = reply.trim();
  if (!pending?.trim() || !r) return r;
  if (topicSwitchTarget(r) !== null) return r;
  // A question, an explain ask, a refinement or small talk is a turn of its
  // own — see `isStandaloneTurn` for the quiz that was built from «اشرح لي».
  if (isStandaloneTurn(r)) return r;
  const replySubject = extractQuerySubjectId(r);
  const pendingSubject = extractQuerySubjectId(pending);
  if (replySubject && pendingSubject && replySubject !== pendingSubject) return r;
  // A full new ask ("a quiz on fractions") is its own message.
  if (artifactFromAsk(r) && stripSubjectNames(topicFromQuery(r)).length >= 3) return r;
  // The reply's grade replaces the one the chat guessed.
  const base = extractQueryGradeId(r) ? stripScopePhrases(pending) : pending.trim();
  return `${base} ${r}`;
}

/**
 * Decide whether chat should force the session's active lesson into results.
 * Soft pins must not override a confident KB hit for a different topic.
 * Teacher-uploaded documents beat a soft-pinned default lesson.
 * A message that names a new topic never reuses the old lesson, however pinned.
 * Same for a message that names a different grade than the active lesson's own.
 */
export function shouldReuseActiveLesson(opts: {
  memory: ChatSessionMemory;
  intent: 'teaching' | 'artifact' | 'refinement' | string;
  query: string;
  hasConfidentKbHit: boolean;
  /** Ready session documents — soft pin must not steal their topic. */
  hasDocuments?: boolean;
  /** The active lesson's own grade — bail when the query names a different one. */
  activeLessonGradeId?: string | null;
  /** The active lesson's own subject — bail when the query names, or KB points at, a different one. */
  activeLessonSubjectId?: string | null;
  /** Subject of the top-ranked KB hit (only passed when score ≥ KB_SUGGEST_SCORE). */
  topRankedSubjectId?: string | null;
}): boolean {
  const {
    memory, intent, query, hasConfidentKbHit,
    hasDocuments = false, activeLessonGradeId = null,
    activeLessonSubjectId = null, topRankedSubjectId = null,
  } = opts;
  if (!memory.activeLessonId || memory.lessonPin === 'none') return false;
  if (topicSwitchTarget(query) !== null) return false;
  const queryGradeId = extractQueryGradeId(query);
  if (queryGradeId && activeLessonGradeId && queryGradeId !== activeLessonGradeId) return false;
  // «علمني» / «ابدأ» name no topic: the open lesson is the only one they can
  // mean, so what the KB ranks for the verb itself is noise, not evidence of
  // another subject («start» ranks «تأسيس مشروع تجاري» at 92).
  const bareTeach = intent === 'teaching' && isBareTeachAsk(query);
  // KB evidence for a different subject beats the hard pin
  if (
    !bareTeach
    && activeLessonSubjectId && topRankedSubjectId && topRankedSubjectId !== activeLessonSubjectId
  ) return false;
  const querySubjectId = extractQuerySubjectId(query);
  if (querySubjectId && activeLessonSubjectId && querySubjectId !== activeLessonSubjectId) return false;

  // Uploads are primary context until the teacher hard-pins a curriculum lesson
  if (hasDocuments && memory.lessonPin !== 'hard' && intent !== 'refinement') {
    return false;
  }

  if (intent === 'refinement' || isReferentialQuery(query)) return true;
  // Without this a soft pin is not reused for a teaching ask, and the
  // pipeline searches the curriculum for the verb itself.
  if (bareTeach) return true;

  if (intent === 'artifact') {
    if (memory.lessonPin === 'hard') return true;
    // Soft pin: reuse only for bare shortcuts (no competing topic in the query)
    return isBareArtifactShortcut(query) && !hasConfidentKbHit;
  }

  // Teaching: hard pin only when retrieval is weak; soft never forces
  if (memory.lessonPin === 'hard' && !hasConfidentKbHit) return true;
  return false;
}

export function pinLesson(
  memory: ChatSessionMemory,
  lesson: KBLesson,
  strength: LessonPinStrength,
): ChatSessionMemory {
  return {
    ...memory,
    activeLessonId: lesson.id,
    activeTopicAr: lesson.titleAr,
    activeTopicEn: lesson.titleEn,
    lessonPin: strength,
    prepLessonId: memory.prepLessonId ?? lesson.id,
  };
}

/**
 * Soft-restore a lesson without stepping on a hard pin.
 *
 * The saved home pick is loaded asynchronously on mount and soft-pinned. That
 * was unconditional, so on a cold start reached through a deep link the promise
 * could resolve *after* the deep-linked lesson was hard-pinned and quietly
 * replace it — the lesson card then names the home pick while the answer is
 * about the lesson the teacher navigated from. A hard pin is something the
 * teacher said out loud (the picker, or arriving from a lesson page); a restore
 * is only what they said last time.
 */
export function softPinIfUnpinned(
  memory: ChatSessionMemory,
  lesson: KBLesson,
): ChatSessionMemory {
  return memory.lessonPin === 'hard' ? memory : pinLesson(memory, lesson, 'soft');
}

export type CurrentLessonView = {
  curriculumLabel: string;
  subjectGrade: string;
  unitLesson: string;
  topic: string;
  lessonId: string;
  /**
   * The active lesson's own subject, from its book — `mathematics`,
   * `chemistry`, `financial-literacy`. Callers that generate material must
   * pass this along instead of defaulting to maths: `isMathContext` reads the
   * subject name, so a chemistry lesson announced as "Mathematics" is served a
   * deck of algebra questions with the chemistry title pasted on top.
   */
  subjectId: string;
  /** English subject name — the string the generators expect. */
  subjectName: string;
  uploadedCount: number;
  resources: ResourceChip[];
};

/** The lesson's subject, defaulting to maths when it has no book. */
function subjectOfLesson(lesson: KBLesson | null): { subjectId: string; subjectName: string } {
  const book = lesson ? getBookForLesson(lesson) : undefined;
  if (!book) return { subjectId: 'mathematics', subjectName: 'Mathematics' };
  const subject = getPickerSubjects().find(s => s.id === book.subjectId);
  return {
    subjectId: book.subjectId,
    subjectName: subject?.name ?? 'Mathematics',
  };
}

export function buildCurrentLessonView(
  memory: ChatSessionMemory,
  docs: SessionDocument[],
  lang: 'ar' | 'en',
): CurrentLessonView | null {
  const lesson = resolveActiveLesson(memory)
    ?? getLessonById(DEFAULT_ACTIVE_LESSON_ID)
    ?? getLessonById(DEMO_CONTINUE.lessonId)
    ?? null;
  if (!lesson && !memory.activeTopicAr && !memory.activeTopicEn) return null;

  const isAr = lang === 'ar';
  const topic = isAr
    ? (memory.activeTopicAr ?? lesson?.titleAr ?? DEMO_CONTINUE.lessonTitleAr)
    : (memory.activeTopicEn ?? lesson?.titleEn ?? DEMO_CONTINUE.lessonTitleEn);

  let curriculumLabel = isAr ? '🇯🇴 المنهاج الأردني' : '🇯🇴 Jordan Curriculum';
  let subjectGrade = isAr ? 'الرياضيات • الصف العاشر' : 'Mathematics • Grade 10';
  let unitLesson = isAr
    ? `${DEMO_CONTINUE.unitNumber} • ${topic}`
    : `Unit ${DEMO_CONTINUE.unitNumber} • ${topic}`;

  if (lesson) {
    const ctx = resolveCurriculumContext(lesson);
    curriculumLabel = isAr ? `🇯🇴 ${ctx.curriculumAr}` : `🇯🇴 ${ctx.curriculumEn}`;
    subjectGrade = isAr
      ? `${ctx.subjectAr} • ${ctx.gradeAr}`
      : `${ctx.subjectEn} • ${ctx.gradeEn}`;
    const unitTitle = isAr ? ctx.unitTitleAr : ctx.unitTitleEn;
    unitLesson = unitTitle
      ? (isAr ? `${unitTitle} • ${topic}` : `${unitTitle} • ${topic}`)
      : topic;
  }

  const readyDocs = docs.filter(d => d.status === 'ready' || d.status === 'parsing' || d.status === 'ocr' || d.status === 'queued' || d.status === 'uploading');

  return {
    curriculumLabel,
    subjectGrade,
    unitLesson,
    topic,
    lessonId: lesson?.id ?? memory.activeLessonId ?? DEFAULT_ACTIVE_LESSON_ID,
    ...subjectOfLesson(lesson),
    uploadedCount: readyDocs.length,
    resources: RESOURCE_META.map(meta => ({
      ...meta,
      done: hasGeneratedResource(memory, meta.type),
    })),
  };
}

/**
 * Intelligent composer suggestions from the current lesson state.
 * Prefer next missing resource; offer refine when it already exists.
 */
export function buildLessonSuggestions(
  memory: ChatSessionMemory,
  lang: 'ar' | 'en',
  hasDocs: boolean,
): LessonSuggestion[] {
  const topic = lang === 'ar'
    ? (memory.activeTopicAr ?? 'الدرس الحالي')
    : (memory.activeTopicEn ?? 'the current lesson');
  const lessonId = memory.activeLessonId ?? undefined;
  const out: LessonSuggestion[] = [];

  const hasPlan = hasGeneratedResource(memory, 'lesson-plan');
  const hasWs = hasGeneratedResource(memory, 'worksheet');
  const hasQuiz = hasGeneratedResource(memory, 'quiz');
  const hasHw = hasGeneratedResource(memory, 'homework');
  const hasAct = hasGeneratedResource(memory, 'activity');

  if (!hasPlan) {
    out.push({
      id: 'create-plan',
      emoji: '📄',
      labelAr: 'حضّر خطة الدرس',
      labelEn: 'Create lesson plan',
      promptAr: `حضّر خطة درس كاملة عن: ${topic}`,
      promptEn: `Prepare a full lesson plan about: ${topic}`,
      toolType: 'lesson-plan',
      lessonId,
    });
  } else {
    out.push({
      id: 'refine-plan',
      emoji: '✏️',
      labelAr: 'حسّن خطة الدرس',
      labelEn: 'Improve lesson plan',
      promptAr: `حسّن خطة الدرس عن «${topic}» واجعلها أوضح للتنفيذ في الحصة القادمة`,
      promptEn: `Improve the current lesson plan for "${topic}" and make it clearer to run tomorrow`,
      toolType: 'lesson-plan',
      lessonId,
    });
  }

  if (!hasWs) {
    out.push({
      id: 'create-ws',
      emoji: '📝',
      labelAr: 'أنشئ ورقة عمل',
      labelEn: 'Create worksheet',
      promptAr: `أنشئ ورقة عمل صفية عن: ${topic}`,
      promptEn: `Create an in-class worksheet about: ${topic}`,
      toolType: 'worksheet',
      lessonId,
    });
  } else if (!hasQuiz) {
    out.push({
      id: 'create-quiz',
      emoji: '➕',
      labelAr: 'جهّز اختباراً قصيراً',
      labelEn: 'Create short quiz',
      promptAr: `جهّز اختباراً قصيراً عن: ${topic}`,
      promptEn: `Create a short quiz about: ${topic}`,
      toolType: 'quiz',
      lessonId,
    });
  }

  if (hasWs && !hasHw) {
    out.push({
      id: 'create-hw',
      emoji: '🏠',
      labelAr: 'أنشئ واجباً منزلياً',
      labelEn: 'Create homework',
      promptAr: `أنشئ واجباً منزلياً عن: ${topic}`,
      promptEn: `Create homework about: ${topic}`,
      toolType: 'homework',
      lessonId,
    });
  }

  if (!hasAct && (hasPlan || hasWs)) {
    out.push({
      id: 'create-act',
      emoji: '🎯',
      labelAr: 'اقترح نشاطاً صفياً',
      labelEn: 'Class activity',
      promptAr: `اقترح نشاطاً صفياً عن: ${topic}`,
      promptEn: `Suggest a classroom activity about: ${topic}`,
      toolType: 'activity',
      lessonId,
    });
  }

  if (hasQuiz) {
    out.push({
      id: 'harder-quiz',
      emoji: '🔥',
      labelAr: 'اجعل الاختبار أصعب',
      labelEn: 'Make quiz harder',
      promptAr: 'اجعل الاختبار أصعب وأضف سؤالين',
      promptEn: 'Make the quiz harder and add two questions',
      toolType: 'quiz',
      lessonId,
    });
  }

  if (hasDocs) {
    out.push({
      id: 'summarize-docs',
      emoji: '📋',
      labelAr: 'لخّص من الملفات',
      labelEn: 'Summarize from files',
      promptAr: 'لخّص الدرس من الملفات المرفوعة بنقاط واضحة',
      promptEn: 'Summarize the lesson from the uploaded files clearly for the teacher',
      lessonId,
    });
  }

  // Cap to keep the strip calm
  return out.slice(0, 5);
}

export function resourceRoute(type: SessionArtifact): string {
  switch (type) {
    case 'lesson-plan': return '/ai-tools/lesson-plan';
    case 'worksheet': return '/ai-tools/worksheet';
    case 'homework': return '/ai-tools/worksheet';
    case 'quiz': return '/ai-tools/quiz';
    case 'activity': return '/ai-tools/activity';
  }
}
