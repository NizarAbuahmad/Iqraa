/**
 * Grade 4 Math (الرياضيات) — Semester 2 (HarperCollins/NCCD student book).
 * Source of truth: data/iqra_curriculum_g4_math_sem2.json
 *
 * Same shape as g4MathSem1 — see that file's header. Units are numbered
 * 6-10, continuing Semester 1's 1-5, matching the book's own cover and
 * contents page. Unit 9 (القياس) folds two "توسعة الدرس" (lesson extension)
 * spreads — one after Lesson 5 (perimeter), one after Lesson 6 (area) — into
 * their parent lesson rather than counting them as separate lessons; the
 * book gives them no lesson number of their own either.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g4_math_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G4_MATH_S2_BOOK_ID = 'kb-math-4-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G4_MATH_S2_CURRICULUM_BOOK_ID = 'book-math-4-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-4', subject: 'math', semester: 2 },
  kbBookId: G4_MATH_S2_BOOK_ID,
  browserBookId: G4_MATH_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG4MathSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u6 → kbu-g4-math-s2-nccd-u6). */
export const g4MathSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u6_l1 → kbl-g4-math-s2-nccd-u6_l1). */
export const g4MathSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG4MathSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG4MathSem2Catalog = catalog.buildCatalog;
export const buildG4MathSem2BrowserCatalog = catalog.buildBrowserCatalog;
