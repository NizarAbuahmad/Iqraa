/**
 * Grade 1 Science (العلوم) — Semester 2 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g1_science_sem2.json
 *
 * Same shape as g1ScienceSem1 — see that file's header. Units are numbered
 * 4-6, continuing Semester 1's 1-3, matching the book's own contents page.
 * 2+4+3 lessons.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g1_science_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G1_SCIENCE_S2_BOOK_ID = 'kb-science-1-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G1_SCIENCE_S2_CURRICULUM_BOOK_ID = 'book-science-1-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-1', subject: 'science', semester: 2 },
  kbBookId: G1_SCIENCE_S2_BOOK_ID,
  browserBookId: G1_SCIENCE_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG1ScienceSem2: NccdCurriculumFile = catalog.curriculum;
export const g1ScienceSem2UnitKbId = catalog.unitKbId;
export const g1ScienceSem2LessonKbId = catalog.lessonKbId;
export const findG1ScienceSem2LessonByKbId = catalog.findLessonByKbId;
export const buildG1ScienceSem2Catalog = catalog.buildCatalog;
export const buildG1ScienceSem2BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G1ScienceSem2Lesson };
