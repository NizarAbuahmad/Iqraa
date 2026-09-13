/**
 * Grade 9 Digital Skills (المهارات الرقمية) — Semester 1 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g9_digital_sem1.json
 *
 * Built through `makeNccdCatalog` — see `nccdCatalog.ts`.
 *
 * **Unlike the Grade 10 book of the same subject, this one's «نتاجاتُ
 * التعلُّمِ» headings extract cleanly.** `g10DigitalSem1.ts` records the trap:
 * there the heading is set in a display font, so grepping the extracted text
 * finds it on 1 page out of 208 while the book prints it on all eleven
 * lessons, and reading the extraction concluded "this book has no outcomes"
 * — wrongly. Checked here rather than assumed either way: the heading is
 * present on all nine lesson openers in the extraction, and the outcomes were
 * transcribed from it.
 *
 * Periods are null and will stay null: **no teacher guide exists for this
 * subject at any grade**, and period counts are a teacher-guide field. That is
 * a missing source, not a missing transcription.
 *
 * Semester 2 is mapped (units 3 and 4, nine lessons) but not yet transcribed,
 * so this subject is Grade 9 Semester 1 only for now — the same shape as
 * Grade 10 financial literacy in MVP_BOOK_IDS.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g9_digital_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G9_DIGITAL_S1_BOOK_ID = 'kb-digital-9-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G9_DIGITAL_S1_CURRICULUM_BOOK_ID = 'book-digital-9-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-9', subject: 'digital', semester: 1 },
  kbBookId: G9_DIGITAL_S1_BOOK_ID,
  browserBookId: G9_DIGITAL_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG9DigitalSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g9-digital-s1-nccd-u1). */
export const g9DigitalSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g9-digital-s1-nccd-u1_l1). */
export const g9DigitalSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG9DigitalSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG9DigitalSem1Catalog = catalog.buildCatalog;
export const buildG9DigitalSem1BrowserCatalog = catalog.buildBrowserCatalog;
