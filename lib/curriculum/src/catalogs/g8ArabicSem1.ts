/**
 * Grade 8 Arabic (اللغة العربية لغتي) — Semester 1 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g8_arabic_sem1.json
 *
 * Built through `makeNccdCatalog` — see `nccdCatalog.ts` — mirrors
 * g9ArabicSem1.ts exactly: five units, five lessons apiece (one per language
 * strand — الاستماع، التحدُّث، القراءة، الكتابة، البناء اللغوي).
 *
 * Objectives are the numbered «كفايات» items printed on each unit's
 * «كفايات الوحدة» page — copied verbatim, not summarised.
 *
 * Periods are null: no teacher guide for this semester is on disk. Vocabulary
 * is empty: this book prints no bilingual terms box. Semester 2 is attached
 * too, in g8ArabicSem2.ts — the file once ignored here as a misfiled Grade 7
 * book is only misNAMED; see the JSON's `known_gaps`.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g8_arabic_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G8_ARABIC_S1_BOOK_ID = 'kb-arabic-8-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G8_ARABIC_S1_CURRICULUM_BOOK_ID = 'book-arabic-8-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-8', subject: 'arabic', semester: 1 },
  kbBookId: G8_ARABIC_S1_BOOK_ID,
  browserBookId: G8_ARABIC_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG8ArabicSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g8-arabic-s1-nccd-u1). */
export const g8ArabicSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g8-arabic-s1-nccd-u1_l1). */
export const g8ArabicSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG8ArabicSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG8ArabicSem1Catalog = catalog.buildCatalog;
export const buildG8ArabicSem1BrowserCatalog = catalog.buildBrowserCatalog;
