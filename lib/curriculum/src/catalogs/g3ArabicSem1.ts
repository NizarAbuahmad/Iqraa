/**
 * Grade 3 Arabic (اللغة العربية لغتي) — Semester 1.
 * Source of truth: data/iqra_curriculum_g3_arabic_sem1.json
 *
 * Title-only for the same reason as g4ArabicSem1/g5ArabicSem1 — see
 * g5ArabicSem1's header for the full rationale. This book matches the same
 * structure: five units per semester, five fixed-pattern lessons per unit
 * (أستمع، أتحدث، أقرأ، أكتب، أبني لغتي). Unlike g5ArabicSem1, the استماع and
 * تحدث lessons (first and second) carry no parenthetical topic in this
 * book's own contents page or lesson-opener — only أقرأ (third) and أكتب
 * (fourth) do.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g3_arabic_sem1.json' with { type: 'json' };
import { lessonKbPrefix, unitKbPrefix, type CurriculumIdScope } from '../curriculumIds.ts';
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G3_ARABIC_S1_BOOK_ID = 'kb-arabic-3-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G3_ARABIC_S1_CURRICULUM_BOOK_ID = 'book-arabic-3-s1';

const SCOPE: CurriculumIdScope = { gradeId: 'grade-3', subject: 'arabic', semester: 1 };

const catalog = makeNccdCatalog({
  scope: SCOPE,
  kbBookId: G3_ARABIC_S1_BOOK_ID,
  browserBookId: G3_ARABIC_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG3ArabicSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g3-arabic-s1-nccd-u1). */
export const g3ArabicSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g3-arabic-s1-nccd-u1_l1). */
export const g3ArabicSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG3ArabicSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

/** True for every unit in this book — see the header for why it is unconditional. */
export function isG3ArabicSem1TitleOnlyUnit(unitKbId: string): boolean {
  return unitKbId.startsWith(unitKbPrefix(SCOPE));
}

/** True for every lesson in this book — see the header for why it is unconditional. */
export function isG3ArabicSem1TitleOnlyLesson(kbLessonId: string): boolean {
  return kbLessonId.startsWith(lessonKbPrefix(SCOPE));
}

export const buildG3ArabicSem1Catalog = catalog.buildCatalog;
export const buildG3ArabicSem1BrowserCatalog = catalog.buildBrowserCatalog;
