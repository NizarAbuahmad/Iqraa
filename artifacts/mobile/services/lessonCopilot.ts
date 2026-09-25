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

/** Bare tool shortcut with little/no topic signal (e.g. "خطة", "اختبار قصير"). */
export function isBareArtifactShortcut(query: string): boolean {
  const q = query.trim();
  return /^(إعداد\s*)?(خطة(\s*درس)?|ورقة(\s*عمل)?|اختبار(\s*قصير)?|واجب(\s*منزلي)?|نشاط(\s*صفي)?|homework|quiz|worksheet|lesson\s*plan|activity)$/i.test(q);
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
const GRADE_PATTERNS_AR: Array<[gradeId: string, pattern: RegExp]> = [
  ['grade-1', /الصف\s*ال(?:أ|ا)ول/],
  ['grade-2', /الصف\s*الثاني(?!\s*عشر)/],
  ['grade-3', /الصف\s*الثالث/],
  ['grade-4', /الصف\s*الرابع/],
  ['grade-5', /الصف\s*الخامس/],
  ['grade-6', /الصف\s*السادس/],
  ['grade-7', /الصف\s*السابع/],
  ['grade-8', /الصف\s*الثامن/],
  ['grade-9', /الصف\s*التاسع/],
  ['grade-10', /الصف\s*العاشر/],
  ['grade-11', /الصف\s*الحادي\s*عشر/],
  ['grade-12', /الصف\s*الثاني\s*عشر/],
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
}): boolean {
  const { memory, intent, query, hasConfidentKbHit, hasDocuments = false, activeLessonGradeId = null } = opts;
  if (!memory.activeLessonId || memory.lessonPin === 'none') return false;
  if (topicSwitchTarget(query) !== null) return false;
  const queryGradeId = extractQueryGradeId(query);
  if (queryGradeId && activeLessonGradeId && queryGradeId !== activeLessonGradeId) return false;

  // Uploads are primary context until the teacher hard-pins a curriculum lesson
  if (hasDocuments && memory.lessonPin !== 'hard' && intent !== 'refinement') {
    return false;
  }

  if (intent === 'refinement' || isReferentialQuery(query)) return true;

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
