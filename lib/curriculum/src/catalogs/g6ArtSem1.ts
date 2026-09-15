/**
 * Grade 6 Art Education (التربية الفنية) — Semester 1 (NCCD teacher guide).
 * Source of truth: data/iqra_curriculum_g6_art_sem1.json
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
 * Two things make this the thinnest source in the Grade 6 set, both recorded in
 * the JSON's known_gaps: there is no student book at all (this teacher guide is
 * the only source), and it is a 2015 edition — a decade older than every other
 * Grade 6 book here. Its content is organised in «محاور» (strands) rather than
 * units; a strand is carried as a unit because that is its position in the
 * structure. Its text is also unvocalised, unlike the rest, so titles are
 * carried without added diacritics.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g6_art_sem1.json' with { type: 'json' };
import { lessonKbPrefix, unitKbPrefix, type CurriculumIdScope } from '../curriculumIds.ts';
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G6_ART_S1_BOOK_ID = 'kb-art-6-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G6_ART_S1_CURRICULUM_BOOK_ID = 'book-art-6-s1';

const SCOPE: CurriculumIdScope = { gradeId: 'grade-6', subject: 'arts', semester: 1 };

const catalog = makeNccdCatalog({
  scope: SCOPE,
  kbBookId: G6_ART_S1_BOOK_ID,
  browserBookId: G6_ART_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG6ArtSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g6-arts-s1-nccd-u1). */
export const g6ArtSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g6-arts-s1-nccd-u1_l1). */
export const g6ArtSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG6ArtSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

/** True for every unit in this book — see the header for why it is unconditional. */
export function isG6ArtSem1TitleOnlyUnit(unitKbId: string): boolean {
  return unitKbId.startsWith(unitKbPrefix(SCOPE));
}

/** True for every lesson in this book — see the header for why it is unconditional. */
export function isG6ArtSem1TitleOnlyLesson(kbLessonId: string): boolean {
  return kbLessonId.startsWith(lessonKbPrefix(SCOPE));
}

export const buildG6ArtSem1Catalog = catalog.buildCatalog;
export const buildG6ArtSem1BrowserCatalog = catalog.buildBrowserCatalog;
