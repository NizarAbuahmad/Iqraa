/**
 * "What is still missing for this lesson?" — the home screen's prep board.
 *
 * The chat screen answers this from `ChatSessionMemory`, which lives inside
 * that screen's React state and dies with it: a teacher who generated a
 * worksheet yesterday, or from the tools tab, sees nothing. The workspace is
 * the only record that outlives a session, so the board reads saved materials
 * and matches them to the lesson by topic.
 *
 * Pure TypeScript, no React and no imports that reach react-native — the
 * screen renders it, this decides it, and `node --test` can run it.
 */

/** The five materials the product actually pushes, in the order a teacher prepares them. */
export type PrepType = 'lesson-plan' | 'worksheet' | 'quiz' | 'slides' | 'activity';

/**
 * Structural stand-in for `SavedMaterial` (services/workspace.ts). Declared
 * here rather than imported because that module loads AsyncStorage at module
 * scope, which the bare `node --test` runner cannot load at all.
 */
export type MaterialLike = {
  id: string;
  /** `SavedMaterial['type']` — 'lesson' | 'worksheet' | 'quiz' | 'flow' | 'activity' | 'slides' | 'prompt-slides' */
  type: string;
  title: string;
  topic: string;
  savedAt: string;
};

export type PrepRowMeta = {
  type: PrepType;
  emoji: string;
  labelAr: string;
  labelEn: string;
  /** The generator that makes this material. */
  route: string;
};

export type PrepRow = PrepRowMeta & {
  done: boolean;
  /** The most recently saved material of this type for the lesson, if any. */
  material: MaterialLike | null;
  /** How many of this type exist for the lesson (a teacher may keep two worksheets). */
  count: number;
};

export const PREP_ROWS: PrepRowMeta[] = [
  { type: 'lesson-plan', emoji: '📘', labelAr: 'خطة الدرس', labelEn: 'Lesson plan', route: '/ai-tools/lesson-plan' },
  { type: 'worksheet', emoji: '📝', labelAr: 'ورقة عمل', labelEn: 'Worksheet', route: '/ai-tools/worksheet' },
  { type: 'quiz', emoji: '✅', labelAr: 'اختبار قصير', labelEn: 'Quiz', route: '/ai-tools/quiz' },
  { type: 'slides', emoji: '🎬', labelAr: 'عرض الحصة', labelEn: 'Class slides', route: '/ai-tools/slides' },
  { type: 'activity', emoji: '🎯', labelAr: 'نشاط صفّي', labelEn: 'Class activity', route: '/ai-tools/activity' },
];

/**
 * Workspace material type → board row.
 *
 * 'flow' (classroom builder) has no row: it is a sequence *of* these
 * materials, so counting it would tick a box nothing was made for.
 */
function rowTypeOf(materialType: string): PrepType | null {
  switch (materialType) {
    case 'lesson': return 'lesson-plan';
    case 'worksheet': return 'worksheet';
    case 'quiz': return 'quiz';
    case 'slides':
    case 'prompt-slides': return 'slides';
    case 'activity': return 'activity';
    default: return null;
  }
}

/**
 * Compare two topic strings the way a teacher would read them.
 *
 * A material saved from the tools tab carries the topic the *form* held, and a
 * material saved from chat carries the one the chat held. They are the same
 * lesson and rarely the same bytes: one may be «تركيب الاقترانات» and the
 * other «تَرْكِيبُ الِاقْتِرَانَات» with diacritics, or carry a trailing
 * space. Byte equality would report every one of those as "nothing prepared",
 * which is worse than a rare false tick — the board exists to stop a teacher
 * re-making what they already have.
 */
export function normalizeTopic(s: string): string {
  return (s ?? '')
    .replace(/[ً-ْٰـ]/g, '') // harakat, dagger alef, tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[يى]/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')           // punctuation, bullets, dashes
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function sameTopic(a: string, b: string): boolean {
  const x = normalizeTopic(a);
  const y = normalizeTopic(b);
  return x.length > 0 && x === y;
}

/** Materials saved for this lesson's topic, newest first. */
export function materialsForTopic<T extends MaterialLike>(materials: T[], topic: string): T[] {
  return materials
    .filter(m => sameTopic(m.topic, topic))
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** The five rows, each saying whether the lesson already has that material. */
export function buildPrepBoard(materials: MaterialLike[], topic: string): PrepRow[] {
  const mine = materialsForTopic(materials, topic);
  return PREP_ROWS.map(meta => {
    const hits = mine.filter(m => rowTypeOf(m.type) === meta.type);
    return { ...meta, done: hits.length > 0, material: hits[0] ?? null, count: hits.length };
  });
}

export function prepSummary(rows: PrepRow[]): { done: number; total: number } {
  return { done: rows.filter(r => r.done).length, total: rows.length };
}
