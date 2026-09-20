/**
 * Grade 5 Math (الرياضيات) — Semester 2 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g5_math_sem2.json
 *
 * Built through `makeNccdCatalog` — see `nccdCatalog.ts`. Units are numbered
 * 6-10, continuing Semester 1's 1-5 rather than restarting — verified against
 * the book's own printed «الْوَحْدَةُ...» headers (pp. 6, 38, 60, 98, 124), the
 * same convention as Grade 5 Science.
 *
 * Like g5MathSem1, this book prints no «الفكرةُ الرئيسةُ» box — «فِكْرَةُ
 * الدَّرْسِ» (the learning-outcomes list) fills `objectives`, and
 * `main_idea_ar` stays empty. Unlike Semester 1, this book glosses only some
 * vocabulary terms in English (usually just the first of a related group,
 * not every one) rather than most of them — see the JSON's known_gaps for
 * which terms have no confirmed gloss. One lesson (u7_l3) takes its
 * vocabulary box from the «نَشاطٌ مَفاهيمِيٌّ» page immediately before it
 * rather than from its own lesson-opener page — also noted in known_gaps.
 *
 * Only the twenty-seven numbered lessons are carried, matching the printed
 * table of contents (p4-5) exactly: 5 units, 8+4+7+4+4 lessons. Conceptual
 * activities («نَشاطٌ مَفاهيميٌّ»), unit projects, end-of-unit tests and the
 * unnumbered «تَوْسِعَةُ الدَّرْسِ 4» in Unit 9 are absent — the book gives them
 * no lesson number.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g5_math_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G5_MATH_S2_BOOK_ID = 'kb-math-5-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G5_MATH_S2_CURRICULUM_BOOK_ID = 'book-math-5-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-5', subject: 'math', semester: 2 },
  kbBookId: G5_MATH_S2_BOOK_ID,
  browserBookId: G5_MATH_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG5MathSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u6 → kbu-g5-math-s2-nccd-u6). */
export const g5MathSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u6_l1 → kbl-g5-math-s2-nccd-u6_l1). */
export const g5MathSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG5MathSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG5MathSem2Catalog = catalog.buildCatalog;
export const buildG5MathSem2BrowserCatalog = catalog.buildBrowserCatalog;
