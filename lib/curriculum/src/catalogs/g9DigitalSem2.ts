/**
 * Grade 9 Digital Skills (المهارات الرقمية) — Semester 2 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g9_digital_sem2.json
 *
 * Mirrors g9DigitalSem1.ts. Units 3 and 4 — numbering continues from S1.
 *
 * **The contents page is not a reliable index of lesson openers in this
 * book.** Its page numbers point at where a lesson's body starts, not at the
 * «الفكرةُ الرئيسةُ» box: unit 4's second lesson is listed at page 115 and its
 * opener is on 113. Reading the openers off the contents page would have
 * transcribed mid-lesson prose as a lesson's main idea, which looks like
 * content rather than like an error. Opener pages were located by searching
 * the extracted text for the heading itself.
 *
 * Periods are null and will stay null: no teacher guide exists for this
 * subject at any grade.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g9_digital_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G9_DIGITAL_S2_BOOK_ID = 'kb-digital-9-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G9_DIGITAL_S2_CURRICULUM_BOOK_ID = 'book-digital-9-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-9', subject: 'digital', semester: 2 },
  kbBookId: G9_DIGITAL_S2_BOOK_ID,
  browserBookId: G9_DIGITAL_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG9DigitalSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u3 → kbu-g9-digital-s2-nccd-u3). */
export const g9DigitalSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u3_l1 → kbl-g9-digital-s2-nccd-u3_l1). */
export const g9DigitalSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG9DigitalSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG9DigitalSem2Catalog = catalog.buildCatalog;
export const buildG9DigitalSem2BrowserCatalog = catalog.buildBrowserCatalog;
