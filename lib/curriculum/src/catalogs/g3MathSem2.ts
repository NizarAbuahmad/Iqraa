/**
 * Grade 3 Math (الرياضيات) — Semester 2 (HarperCollins/NCCD student book).
 * Source of truth: data/iqra_curriculum_g3_math_sem2.json
 *
 * Same shape as g3MathSem1 — see that file's header. Units are numbered
 * 7-12, continuing Semester 1's 1-6, matching the book's own contents page.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g3_math_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G3_MATH_S2_BOOK_ID = 'kb-math-3-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G3_MATH_S2_CURRICULUM_BOOK_ID = 'book-math-3-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-3', subject: 'math', semester: 2 },
  kbBookId: G3_MATH_S2_BOOK_ID,
  browserBookId: G3_MATH_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG3MathSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u7 → kbu-g3-math-s2-nccd-u7). */
export const g3MathSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u7_l1 → kbl-g3-math-s2-nccd-u7_l1). */
export const g3MathSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG3MathSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG3MathSem2Catalog = catalog.buildCatalog;
export const buildG3MathSem2BrowserCatalog = catalog.buildBrowserCatalog;
