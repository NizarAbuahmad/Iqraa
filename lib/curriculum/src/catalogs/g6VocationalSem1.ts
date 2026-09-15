/**
 * Grade 6 Vocational Education (التربية المهنية) — Semester 1 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g6_vocational_sem1.json
 *
 * **Title-only**, like the other Grade 6 humanities books: structure carried
 * from the table of contents, no outcomes, glossary or main idea transcribed.
 * Every unit and lesson answers true to the predicates below, which
 * `catalog.ts` folds into `isBrowserUnitTitleOnly` / `isBrowserLessonTitleOnly`
 * so the UI labels them rather than rendering a lesson that looks empty.
 *
 * This subject reached grade-6 only when `SUBJECTS.grades` was extended for it
 * — it had been declared for grade-7/8 (or grade-7/9) alone, which would have
 * left the book catalogued and permanently unreachable. See catalog.ts.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g6_vocational_sem1.json' with { type: 'json' };
import { lessonKbPrefix, unitKbPrefix, type CurriculumIdScope } from '../curriculumIds.ts';
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G6_VOCATIONAL_S1_BOOK_ID = 'kb-vocational-6-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G6_VOCATIONAL_S1_CURRICULUM_BOOK_ID = 'book-vocational-6-s1';

const SCOPE: CurriculumIdScope = { gradeId: 'grade-6', subject: 'voc', semester: 1 };

const catalog = makeNccdCatalog({
  scope: SCOPE,
  kbBookId: G6_VOCATIONAL_S1_BOOK_ID,
  browserBookId: G6_VOCATIONAL_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG6VocationalSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g6-voc-s1-nccd-u1). */
export const g6VocationalSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g6-voc-s1-nccd-u1_l1). */
export const g6VocationalSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG6VocationalSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

/** True for every unit in this book — see the header for why it is unconditional. */
export function isG6VocationalSem1TitleOnlyUnit(unitKbId: string): boolean {
  return unitKbId.startsWith(unitKbPrefix(SCOPE));
}

/** True for every lesson in this book — see the header for why it is unconditional. */
export function isG6VocationalSem1TitleOnlyLesson(kbLessonId: string): boolean {
  return kbLessonId.startsWith(lessonKbPrefix(SCOPE));
}

export const buildG6VocationalSem1Catalog = catalog.buildCatalog;
export const buildG6VocationalSem1BrowserCatalog = catalog.buildBrowserCatalog;
