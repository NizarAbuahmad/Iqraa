/**
 * Grade 2 Arabic (اللغة العربية لغتي) — Semester 1.
 * Source of truth: data/iqra_curriculum_g2_arabic_sem1.json
 *
 * Title-only for the same reason as g3ArabicSem1/g4ArabicSem1/g5ArabicSem1
 * — see g5ArabicSem1's header for the full rationale. This book matches the
 * same structure: five units per semester, five fixed-pattern lessons per
 * unit (أستمع، أتحدث، أقرأ، أكتب، أبني لغتي). Same as g3ArabicSem1, the
 * استماع and تحدث lessons carry no parenthetical topic — only أقرأ (third)
 * and أكتب (fourth) do.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g2_arabic_sem1.json' with { type: 'json' };
import { lessonKbPrefix, unitKbPrefix, type CurriculumIdScope } from '../curriculumIds.ts';
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G2_ARABIC_S1_BOOK_ID = 'kb-arabic-2-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G2_ARABIC_S1_CURRICULUM_BOOK_ID = 'book-arabic-2-s1';

const SCOPE: CurriculumIdScope = { gradeId: 'grade-2', subject: 'arabic', semester: 1 };

const catalog = makeNccdCatalog({
  scope: SCOPE,
  kbBookId: G2_ARABIC_S1_BOOK_ID,
  browserBookId: G2_ARABIC_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG2ArabicSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g2-arabic-s1-nccd-u1). */
export const g2ArabicSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g2-arabic-s1-nccd-u1_l1). */
export const g2ArabicSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG2ArabicSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

/** True for every unit in this book — see the header for why it is unconditional. */
export function isG2ArabicSem1TitleOnlyUnit(unitKbId: string): boolean {
  return unitKbId.startsWith(unitKbPrefix(SCOPE));
}

/** True for every lesson in this book — see the header for why it is unconditional. */
export function isG2ArabicSem1TitleOnlyLesson(kbLessonId: string): boolean {
  return kbLessonId.startsWith(lessonKbPrefix(SCOPE));
}

export const buildG2ArabicSem1Catalog = catalog.buildCatalog;
export const buildG2ArabicSem1BrowserCatalog = catalog.buildBrowserCatalog;
