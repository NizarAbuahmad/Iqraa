/**
 * Grade 7 English (اللغة الإنجليزية) — Semester 1 ("Jordan Team Together"
 * student book + teacher guide). Source of truth:
 * data/iqra_curriculum_g7_eng_sem1.json
 *
 * Built through `makeNccdCatalog` — see `nccdCatalog.ts`.
 *
 * A DIFFERENT publisher series from Grade 8/9/10's "Jordan High Note" —
 * confirmed from the book's own cover, not inferred. Real structural
 * differences, not just cosmetic ones:
 * - Four numbered units for the whole semester (not five), each with 12
 *   lessons per the teacher guide's own "Lesson division" table — but only
 *   9 of those 12 have a Student Book page; Lessons 4/7/12 are Activity
 *   Book-only and excluded here, matching this repo's LIFE SKILLS-exclusion
 *   precedent. 36 lessons total, not 35.
 * - No boxed "I can" statement anywhere in the student book. The only
 *   printed per-lesson outcome is the teacher guide's own "Lesson aims:"
 *   line, used verbatim (English, unmodified) for both `main_idea_ar` and
 *   the sole `objectives` entry — so this file's outcome provenance is the
 *   teacher guide, not the student book, unlike Grade 8/9.
 * - periods/total_periods ARE populated here (1 per lesson, 12 per unit) —
 *   this guide states the real period count explicitly ("There are 12
 *   lessons in each main unit" = 12 periods), unlike Grade 8/9's guides,
 *   which only subdivide a single lesson into internal phases. total_periods
 *   counts all 12 taught periods, including the 3 activity-book-only
 *   lessons excluded from this file's lesson arrays — it is deliberately
 *   not equal to periods-per-lesson × lesson count.
 *
 * See the JSON's known_gaps for the full accounting.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g7_eng_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G7_ENG_S1_BOOK_ID = 'kb-eng-7-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G7_ENG_S1_CURRICULUM_BOOK_ID = 'book-eng-7-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-7', subject: 'eng', semester: 1 },
  kbBookId: G7_ENG_S1_BOOK_ID,
  browserBookId: G7_ENG_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG7EngSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g7-eng-s1-nccd-u1). */
export const g7EngSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g7-eng-s1-nccd-u1_l1). */
export const g7EngSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG7EngSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG7EngSem1Catalog = catalog.buildCatalog;
export const buildG7EngSem1BrowserCatalog = catalog.buildBrowserCatalog;
