/**
 * Grade 7 Arabic (اللغة العربية لغتي) — Semester 2 (NCCD student book, no
 * teacher guide). Same shape as Semester 1: five units, five lessons
 * apiece. periods/total_periods are null throughout — no teacher guide
 * exists for this semester. Vocabulary stays empty, same reasoning as
 * Semester 1.
 */

import raw from '../data/iqra_curriculum_g7_arabic_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G7_ARABIC_S2_BOOK_ID = 'kb-arabic-7-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G7_ARABIC_S2_CURRICULUM_BOOK_ID = 'book-arabic-7-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-7', subject: 'arabic', semester: 2 },
  kbBookId: G7_ARABIC_S2_BOOK_ID,
  browserBookId: G7_ARABIC_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG7ArabicSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u6 → kbu-g7-arabic-s2-nccd-u6). */
export const g7ArabicSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u6_l1 → kbl-g7-arabic-s2-nccd-u6_l1). */
export const g7ArabicSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG7ArabicSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG7ArabicSem2Catalog = catalog.buildCatalog;
export const buildG7ArabicSem2BrowserCatalog = catalog.buildBrowserCatalog;
