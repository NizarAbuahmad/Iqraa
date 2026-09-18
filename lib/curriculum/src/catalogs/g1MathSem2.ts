/**
 * Grade 1 Math (الرياضيات) — Semester 2 (HarperCollins/NCCD student book).
 * Source of truth: data/iqra_curriculum_g1_math_sem2.json
 *
 * Same shape as g1MathSem1 — see that file's header. Units are numbered
 * 6-11, continuing Semester 1's preparatory unit (0) and units 1-5, matching
 * the book's own contents page.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g1_math_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G1_MATH_S2_BOOK_ID = 'kb-math-1-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G1_MATH_S2_CURRICULUM_BOOK_ID = 'book-math-1-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-1', subject: 'math', semester: 2 },
  kbBookId: G1_MATH_S2_BOOK_ID,
  browserBookId: G1_MATH_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG1MathSem2: NccdCurriculumFile = catalog.curriculum;
export const g1MathSem2UnitKbId = catalog.unitKbId;
export const g1MathSem2LessonKbId = catalog.lessonKbId;
export const findG1MathSem2LessonByKbId = catalog.findLessonByKbId;
export const buildG1MathSem2Catalog = catalog.buildCatalog;
export const buildG1MathSem2BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G1MathSem2Lesson };
