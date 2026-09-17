/**
 * Grade 3 Arabic (اللغة العربية لغتي) — Semester 2.
 * Source of truth: data/iqra_curriculum_g3_arabic_sem2.json
 *
 * Title-only for the same reason as g3ArabicSem1 — see that file's header.
 * Units are numbered 6-10, continuing Semester 1's 1-5, matching the book's
 * own contents page (which itself prints «الوَحْدَةُ السّادِسَةُ» etc., not a
 * restart at «الوَحْدَةُ الأولى»).
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g3_arabic_sem2.json' with { type: 'json' };
import { lessonKbPrefix, unitKbPrefix, type CurriculumIdScope } from '../curriculumIds.ts';
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G3_ARABIC_S2_BOOK_ID = 'kb-arabic-3-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G3_ARABIC_S2_CURRICULUM_BOOK_ID = 'book-arabic-3-s2';

const SCOPE: CurriculumIdScope = { gradeId: 'grade-3', subject: 'arabic', semester: 2 };

const catalog = makeNccdCatalog({
  scope: SCOPE,
  kbBookId: G3_ARABIC_S2_BOOK_ID,
  browserBookId: G3_ARABIC_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG3ArabicSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u6 → kbu-g3-arabic-s2-nccd-u6). */
export const g3ArabicSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u6_l1 → kbl-g3-arabic-s2-nccd-u6_l1). */
export const g3ArabicSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG3ArabicSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

/** True for every unit in this book — see the header for why it is unconditional. */
export function isG3ArabicSem2TitleOnlyUnit(unitKbId: string): boolean {
  return unitKbId.startsWith(unitKbPrefix(SCOPE));
}

/** True for every lesson in this book — see the header for why it is unconditional. */
export function isG3ArabicSem2TitleOnlyLesson(kbLessonId: string): boolean {
  return kbLessonId.startsWith(lessonKbPrefix(SCOPE));
}

export const buildG3ArabicSem2Catalog = catalog.buildCatalog;
export const buildG3ArabicSem2BrowserCatalog = catalog.buildBrowserCatalog;
