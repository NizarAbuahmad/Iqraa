/**
 * Grade 3 Math (الرياضيات) — Semester 1 (HarperCollins/NCCD student book).
 * Source of truth: data/iqra_curriculum_g3_math_sem1.json
 *
 * Built through `makeNccdCatalog` — see `nccdCatalog.ts`. The first Grade 3
 * book in this repo. Read directly from the student book PDF with PyMuPDF —
 * extraction is clean, same HarperCollins series as Grade 4/5/10 Math.
 *
 * Unlike g4MathSem1/g5MathSem1, this book's per-lesson objectives box is
 * printed under the heading «أَتَعَلَّمُ الْيَوْمَ» (not «فِكْرَةُ الدَّرْسِ») — same
 * function, different label, so it still fills `objectives`. `main_idea_ar`
 * stays empty. `vocabulary` comes from the «المُصْطَلَحات» box where the book
 * prints one; most entries print their own English gloss inline (unlike
 * g4MathSem1, which needed hand translation).
 *
 * This book's own unit-opener page carries no «ما أهمية هذه الوحدة؟» /
 * «تعلمت سابقًا» boxes (a family letter and a unit-project description
 * instead) — general_idea_ar and prior_knowledge stay empty for every unit,
 * see the JSON's known_gaps.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g3_math_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G3_MATH_S1_BOOK_ID = 'kb-math-3-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G3_MATH_S1_CURRICULUM_BOOK_ID = 'book-math-3-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-3', subject: 'math', semester: 1 },
  kbBookId: G3_MATH_S1_BOOK_ID,
  browserBookId: G3_MATH_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG3MathSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g3-math-s1-nccd-u1). */
export const g3MathSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g3-math-s1-nccd-u1_l1). */
export const g3MathSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG3MathSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG3MathSem1Catalog = catalog.buildCatalog;
export const buildG3MathSem1BrowserCatalog = catalog.buildBrowserCatalog;
