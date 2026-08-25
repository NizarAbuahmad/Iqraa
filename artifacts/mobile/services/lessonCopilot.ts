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
 * Decide whether chat should force the session's active lesson into results.
 * Soft pins must not override a confident KB hit for a different topic.
 * Teacher-uploaded documents beat a soft-pinned default lesson.
 */
export function shouldReuseActiveLesson(opts: {
  memory: ChatSessionMemory;
  intent: 'teaching' | 'artifact' | 'refinement' | string;
  query: string;
  hasConfidentKbHit: boolean;
  /** Ready session documents — soft pin must not steal their topic. */
  hasDocuments?: boolean;
}): boolean {
  const { memory, intent, query, hasConfidentKbHit, hasDocuments = false } = opts;
  if (!memory.activeLessonId || memory.lessonPin === 'none') return false;

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
