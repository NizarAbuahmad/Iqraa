/**
 * Grade 4 Math (الرياضيات) — Semester 1 (HarperCollins/NCCD student book).
 * Source of truth: data/iqra_curriculum_g4_math_sem1.json
 *
 * Built through `makeNccdCatalog` — see `nccdCatalog.ts`. The first Grade 4
 * book in this repo. Read directly from the student book PDF with PyMuPDF —
 * extraction is clean, same HarperCollins series as Grade 5/10 Math.
 *
 * Same shape as g5MathSem1: this book prints no «الفكرةُ الرئيسةُ» box —
 * «فِكْرَةُ الدَّرْسِ» (the learning-outcomes list) fills `objectives`, and
 * `main_idea_ar` stays empty. `vocabulary` comes from the «المصطلحات» box
 * where the book prints one, translated to English by hand — this book does
 * not print inline English glosses the way g5MathSem1 sometimes does.
 *
 * Only the 23 numbered lessons are carried, matching the printed table of
 * contents (p4-5) exactly: 5 units, 6+4+5+3+5 lessons. Unit projects
 * («مَشْروعُ الْوَحْدَةِ») and end-of-unit tests are absent — the book gives
 * them no lesson number.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g4_math_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G4_MATH_S1_BOOK_ID = 'kb-math-4-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G4_MATH_S1_CURRICULUM_BOOK_ID = 'book-math-4-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-4', subject: 'math', semester: 1 },
  kbBookId: G4_MATH_S1_BOOK_ID,
  browserBookId: G4_MATH_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG4MathSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g4-math-s1-nccd-u1). */
export const g4MathSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g4-math-s1-nccd-u1_l1). */
export const g4MathSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG4MathSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG4MathSem1Catalog = catalog.buildCatalog;
export const buildG4MathSem1BrowserCatalog = catalog.buildBrowserCatalog;
