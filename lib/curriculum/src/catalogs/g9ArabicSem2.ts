/**
 * Grade 9 Arabic (اللغة العربية لغتي) — Semester 2 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g9_arabic_sem2.json
 *
 * Mirrors g9ArabicSem1.ts exactly — same five-strand-per-unit shape, same
 * «كفايات الوحدة» source for objectives, same absence of vocabulary.
 *
 * **This book's own text extraction was refused, twice, in two different
 * ways.** `pdf-parse` failed with whole-run reversal on 2026-09-08 (the
 * damage class that also took out both financial-literacy books — nothing
 * legible to rebuild from, unlike the fragment-reordering seen in earth
 * science S2 and Digital Skills). `tesseract-ocr` on 2026-09-09 produced
 * genuinely readable text this time, but every title and objective in this
 * file was still read from the PDF's page images rather than trusted to
 * either extraction — the same discipline `g9ArabicSem1.ts` used even though
 * S1's pdf-parse output was accepted.
 *
 * Units are numbered 6-10, continuing S1's numbering. The printed page
 * numbers in this book's own contents page do not reliably match the PDF's
 * page order (unit 9's contents entry is off by 4 pages from where its
 * opener actually sits) — recorded in the JSON's known_gaps because it would
 * otherwise look like a transcription error to the next reader.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g9_arabic_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G9_ARABIC_S2_BOOK_ID = 'kb-arabic-9-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G9_ARABIC_S2_CURRICULUM_BOOK_ID = 'book-arabic-9-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-9', subject: 'arabic', semester: 2 },
  kbBookId: G9_ARABIC_S2_BOOK_ID,
  browserBookId: G9_ARABIC_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG9ArabicSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u6 → kbu-g9-arabic-s2-nccd-u6). */
export const g9ArabicSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u6_l1 → kbl-g9-arabic-s2-nccd-u6_l1). */
export const g9ArabicSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG9ArabicSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG9ArabicSem2Catalog = catalog.buildCatalog;
export const buildG9ArabicSem2BrowserCatalog = catalog.buildBrowserCatalog;
