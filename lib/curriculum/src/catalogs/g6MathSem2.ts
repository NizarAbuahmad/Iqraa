/**
 * Grade 6 Math (الرياضيات) — Semester 2 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g6_math_sem2.json
 *
 * Mirrors g6MathSem1.ts: built through `makeNccdCatalog`, same two book-level
 * gaps recorded in the JSON's `known_gaps` (no bilingual headers, no «الفكرةُ
 * الرئيسةُ» box — «فِكْرَةُ الدَّرْسِ» lands in `objectives` instead).
 *
 * Only the twenty-one numbered lessons (units 5-8) are carried. The unit
 * projects, conceptual activities and end-of-unit tests are deliberately
 * absent: the book gives them no lesson number.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g6_math_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G6_MATH_S2_BOOK_ID = 'kb-math-6-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G6_MATH_S2_CURRICULUM_BOOK_ID = 'book-math-6-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-6', subject: 'math', semester: 2 },
  kbBookId: G6_MATH_S2_BOOK_ID,
  browserBookId: G6_MATH_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG6MathSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u5 → kbu-g6-math-s2-nccd-u5). */
export const g6MathSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u5_l1 → kbl-g6-math-s2-nccd-u5_l1). */
export const g6MathSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG6MathSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG6MathSem2Catalog = catalog.buildCatalog;
export const buildG6MathSem2BrowserCatalog = catalog.buildBrowserCatalog;
