/**
 * Grade 7 Science (العلوم) — Semester 2 (NCCD student book + teacher guide).
 * Source of truth: data/iqra_curriculum_g7_science_sem2.json
 *
 * Built through `makeNccdCatalog`, same as Semester 1. Units are numbered
 * 6-10, continuing Semester 1's 1-5 rather than restarting — same pattern as
 * the Grade 8 Science precedent. Unlike Semester 1, this book's teacher
 * guide matches the student book's 11 lessons one-to-one with no extra,
 * missing, or conflicting titles, so every lesson has real periods and every
 * unit has a real total_periods.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g7_science_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G7_SCIENCE_S2_BOOK_ID = 'kb-science-7-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G7_SCIENCE_S2_CURRICULUM_BOOK_ID = 'book-science-7-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-7', subject: 'science', semester: 2 },
  kbBookId: G7_SCIENCE_S2_BOOK_ID,
  browserBookId: G7_SCIENCE_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG7ScienceSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u6 → kbu-g7-science-s2-nccd-u6). */
export const g7ScienceSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u6_l1 → kbl-g7-science-s2-nccd-u6_l1). */
export const g7ScienceSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG7ScienceSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG7ScienceSem2Catalog = catalog.buildCatalog;
export const buildG7ScienceSem2BrowserCatalog = catalog.buildBrowserCatalog;
