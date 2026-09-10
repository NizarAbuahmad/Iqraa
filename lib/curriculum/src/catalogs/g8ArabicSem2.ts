/**
 * Grade 8 Arabic (اللغة العربية لغتي) — Semester 2 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g8_arabic_sem2.json
 *
 * Built through `makeNccdCatalog` — see `nccdCatalog.ts` — mirrors
 * g8ArabicSem1.ts exactly: five units, five lessons apiece (one per language
 * strand — الاستماع، التحدُّث، القراءة، الكتابة، البناء اللغوي).
 *
 * Units are numbered 6-10, continuing Semester 1's 1-5, the same way
 * g9ArabicSem2.ts continues g9ArabicSem1.ts.
 *
 * Objectives are the numbered «كفايات» items printed on each unit's
 * «كفايات الوحدة» page — copied verbatim, not summarised, and assigned to
 * lessons by the skill heading they sit under (مهارة الاستماع / مهارة
 * التحدُّث / …) rather than by their printed numbers, which this book prints
 * inconsistently.
 *
 * **The source PDF's filename is wrong.** It is named «كتاب الطالب لمادة
 * اللغة العربية للصف السابع الفصل الثاني» (Grade 7), and was once dismissed
 * on that basis. Its cover, copyright page and unit numbering all say Grade 8
 * Semester 2 — see the JSON's `known_gaps`. Everything here was read from the
 * PDF's page images, not from a text extraction.
 *
 * Periods are null: no teacher guide for this semester is on disk. Vocabulary
 * is empty: this book prints no bilingual terms box.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g8_arabic_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G8_ARABIC_S2_BOOK_ID = 'kb-arabic-8-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G8_ARABIC_S2_CURRICULUM_BOOK_ID = 'book-arabic-8-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-8', subject: 'arabic', semester: 2 },
  kbBookId: G8_ARABIC_S2_BOOK_ID,
  browserBookId: G8_ARABIC_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG8ArabicSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u6 → kbu-g8-arabic-s2-nccd-u6). */
export const g8ArabicSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u6_l1 → kbl-g8-arabic-s2-nccd-u6_l1). */
export const g8ArabicSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG8ArabicSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG8ArabicSem2Catalog = catalog.buildCatalog;
export const buildG8ArabicSem2BrowserCatalog = catalog.buildBrowserCatalog;
