/**
 * Grade 6 Math (الرياضيات) — Semester 1 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g6_math_sem1.json
 *
 * Built through `makeNccdCatalog` — see `nccdCatalog.ts` — rather than the
 * 300-line hand-rolled shape g9MathSem1.ts still carries. Only three of that
 * file's exports are consumed outside it, and the factory covers all three.
 *
 * The first Grade 6 book in this repo, and the first grade below 8. Nothing in
 * the id machinery needed changing for it: `gradeSlug()` turns any `grade-N`
 * into `gN`, `UNIT_ID_RE` already matches an optional grade segment, and
 * `bankTagsForParsedUnit` reserves the bare `s1-u2` tag vocabulary for Grade 10
 * alone — so this book's units tag as `g6-math-s1-u2` and cannot collide with
 * Grade 10 maths, which is the one subject whose tags are unprefixed.
 *
 * Two ways this book differs from the Grade 8/9 science books the factory was
 * written against, both recorded in the JSON's `known_gaps`:
 *  • No bilingual headers — `title_en` is a translation, not printed text.
 *  • No «الفكرةُ الرئيسةُ» box. The book prints «فِكْرَةُ الدَّرْسِ», which is
 *    the learning-outcomes list, so it lands in `objectives` and
 *    `main_idea_ar` stays empty. The factory reads `main_idea_ar || fallback`,
 *    so an empty string degrades to the generated summary rather than an
 *    empty one.
 *
 * Only the eighteen numbered lessons are carried. The conceptual activities
 * («نَشاطٌ مَفاهيمِيٌّ»), unit projects, the GeoGebra lab and the end-of-unit
 * tests are deliberately absent: the book gives them no lesson number, so
 * minting `u2_l5` for one would invent an id the book does not print.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g6_math_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G6_MATH_S1_BOOK_ID = 'kb-math-6-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G6_MATH_S1_CURRICULUM_BOOK_ID = 'book-math-6-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-6', subject: 'math', semester: 1 },
  kbBookId: G6_MATH_S1_BOOK_ID,
  browserBookId: G6_MATH_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG6MathSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g6-math-s1-nccd-u1). */
export const g6MathSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g6-math-s1-nccd-u1_l1). */
export const g6MathSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG6MathSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG6MathSem1Catalog = catalog.buildCatalog;
export const buildG6MathSem1BrowserCatalog = catalog.buildBrowserCatalog;
