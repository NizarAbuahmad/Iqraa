/**
 * Grade 5 Science (العلوم) — Semester 2 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g5_science_sem2.json
 *
 * Same shape as g5ScienceSem1 — see that file for the factory rationale and
 * what this book does and does not print. Units are numbered 6-10,
 * continuing Semester 1's 1-5 rather than restarting, exactly as the book
 * prints them — the same convention as Grade 6/7/8 science.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g5_science_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G5_SCIENCE_S2_BOOK_ID = 'kb-science-5-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G5_SCIENCE_S2_CURRICULUM_BOOK_ID = 'book-science-5-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-5', subject: 'science', semester: 2 },
  kbBookId: G5_SCIENCE_S2_BOOK_ID,
  browserBookId: G5_SCIENCE_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG5ScienceSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u6 → kbu-g5-science-s2-nccd-u6). */
export const g5ScienceSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u6_l1 → kbl-g5-science-s2-nccd-u6_l1). */
export const g5ScienceSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG5ScienceSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG5ScienceSem2Catalog = catalog.buildCatalog;
export const buildG5ScienceSem2BrowserCatalog = catalog.buildBrowserCatalog;
