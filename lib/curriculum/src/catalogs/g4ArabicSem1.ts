/**
 * Grade 4 Arabic (اللغة العربية لغتي) — Semester 1.
 * Source of truth: data/iqra_curriculum_g4_arabic_sem1.json
 *
 * Title-only for the same reason as g5ArabicSem1 — see that file's header.
 * This book matches Grade 5 Arabic's exact structure: five units per
 * semester, five fixed-pattern lessons per unit (أستمع، أتحدث، أقرأ، أكتب،
 * أبني لغتي).
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g4_arabic_sem1.json' with { type: 'json' };
import { lessonKbPrefix, unitKbPrefix, type CurriculumIdScope } from '../curriculumIds.ts';
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G4_ARABIC_S1_BOOK_ID = 'kb-arabic-4-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G4_ARABIC_S1_CURRICULUM_BOOK_ID = 'book-arabic-4-s1';

const SCOPE: CurriculumIdScope = { gradeId: 'grade-4', subject: 'arabic', semester: 1 };

const catalog = makeNccdCatalog({
  scope: SCOPE,
  kbBookId: G4_ARABIC_S1_BOOK_ID,
  browserBookId: G4_ARABIC_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG4ArabicSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g4-arabic-s1-nccd-u1). */
export const g4ArabicSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g4-arabic-s1-nccd-u1_l1). */
export const g4ArabicSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG4ArabicSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

/** True for every unit in this book — see the header for why it is unconditional. */
export function isG4ArabicSem1TitleOnlyUnit(unitKbId: string): boolean {
  return unitKbId.startsWith(unitKbPrefix(SCOPE));
}

/** True for every lesson in this book — see the header for why it is unconditional. */
export function isG4ArabicSem1TitleOnlyLesson(kbLessonId: string): boolean {
  return kbLessonId.startsWith(lessonKbPrefix(SCOPE));
}

export const buildG4ArabicSem1Catalog = catalog.buildCatalog;
export const buildG4ArabicSem1BrowserCatalog = catalog.buildBrowserCatalog;
