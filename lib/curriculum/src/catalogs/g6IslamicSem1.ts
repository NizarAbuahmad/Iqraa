/**
 * Grade 6 Islamic Education (التربية الإسلامية) — Semester 1 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g6_islamic_sem1.json
 *
 * **Title-only**, like the Grade 6 Arabic books: the structure is carried from
 * the student book's table of contents, and no learning outcomes, glossary or
 * main idea are transcribed. Every unit and lesson therefore answers true to
 * the predicates below, which `catalog.ts` folds into `isBrowserUnitTitleOnly` /
 * `isBrowserLessonTitleOnly`, so the UI says "title confirmed, no per-lesson
 * objectives yet" rather than rendering a lesson that merely looks empty.
 *
 * The lesson page does print an introductory paragraph that would serve as
 * `main_idea_ar`. It is deliberately not transcribed: pdf-parse drops the
 * assimilated lam in these books, so it cannot be quoted from the extracted
 * text, and reading every lesson page as an image is deferred work rather than
 * abandoned work. The book IS extracted and registered, so these lessons are
 * groundable even though the catalogue rows are thin.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g6_islamic_sem1.json' with { type: 'json' };
import { lessonKbPrefix, unitKbPrefix, type CurriculumIdScope } from '../curriculumIds.ts';
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G6_ISLAMIC_S1_BOOK_ID = 'kb-islamic-6-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G6_ISLAMIC_S1_CURRICULUM_BOOK_ID = 'book-islamic-6-s1';

const SCOPE: CurriculumIdScope = { gradeId: 'grade-6', subject: 'islamic', semester: 1 };

const catalog = makeNccdCatalog({
  scope: SCOPE,
  kbBookId: G6_ISLAMIC_S1_BOOK_ID,
  browserBookId: G6_ISLAMIC_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG6IslamicSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g6-islamic-s1-nccd-u1). */
export const g6IslamicSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g6-islamic-s1-nccd-u1_l1). */
export const g6IslamicSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG6IslamicSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

/** True for every unit in this book — see the header for why it is unconditional. */
export function isG6IslamicSem1TitleOnlyUnit(unitKbId: string): boolean {
  return unitKbId.startsWith(unitKbPrefix(SCOPE));
}

/** True for every lesson in this book — see the header for why it is unconditional. */
export function isG6IslamicSem1TitleOnlyLesson(kbLessonId: string): boolean {
  return kbLessonId.startsWith(lessonKbPrefix(SCOPE));
}

export const buildG6IslamicSem1Catalog = catalog.buildCatalog;
export const buildG6IslamicSem1BrowserCatalog = catalog.buildBrowserCatalog;
