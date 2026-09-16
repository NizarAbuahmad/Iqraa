/**
 * Grade 5 Math (الرياضيات) — Semester 1 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g5_math_sem1.json
 *
 * Built through `makeNccdCatalog` — see `nccdCatalog.ts`. The first Grade 5
 * book in this repo. Read directly from the student book PDF with PyMuPDF
 * rather than transcribed from the pdf-parse dump already sitting in
 * data/extracted/g5-math-s1-student-book.json: that dump carries the same
 * ل/hamza reordering `untranspose.ts` targets, compounded by out-of-order
 * sidebar boxes, and is not safe to copy from directly — see the JSON's
 * provenance_note.
 *
 * Like g6MathSem1, this book prints no «الفكرةُ الرئيسةُ» box — «فِكْرَةُ
 * الدَّرْسِ» (the learning-outcomes list) fills `objectives`, and
 * `main_idea_ar` stays empty. Unlike Grade 6 maths, this book DOES print an
 * English gloss for most vocabulary terms inline in «أَسْتَكْشِفُ»/«أَتَعَلَّمُ»
 * (e.g. «(negative number)»), so `vocabulary[].en` is a real translation for
 * most terms rather than a repeated Arabic fallback — the JSON's known_gaps
 * names the handful where no inline gloss was confirmed.
 *
 * Only the twenty-five numbered lessons are carried, matching the printed
 * table of contents (p4-5) exactly: 5 units, 5+5+5+6+4 lessons. Conceptual
 * activities («نَشاطٌ مَفاهيميٌّ»), unit projects and end-of-unit tests are
 * absent — the book gives them no lesson number.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g5_math_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G5_MATH_S1_BOOK_ID = 'kb-math-5-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G5_MATH_S1_CURRICULUM_BOOK_ID = 'book-math-5-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-5', subject: 'math', semester: 1 },
  kbBookId: G5_MATH_S1_BOOK_ID,
  browserBookId: G5_MATH_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG5MathSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g5-math-s1-nccd-u1). */
export const g5MathSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g5-math-s1-nccd-u1_l1). */
export const g5MathSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG5MathSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG5MathSem1Catalog = catalog.buildCatalog;
export const buildG5MathSem1BrowserCatalog = catalog.buildBrowserCatalog;
