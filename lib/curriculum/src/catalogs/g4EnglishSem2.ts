/**
 * Grade 4 English (اللغة الإنجليزية) — Semester 2 ("Jordan Team Together"
 * pupil's book, Pearson/York Press). Source of truth:
 * data/iqra_curriculum_g4_english_sem2.json
 *
 * Not title-only, same shape as g4EnglishSem1 — see that file's header.
 * Units are numbered 6-10, continuing Semester 1's 1-5, matching the book's
 * own contents page.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g4_english_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G4_ENGLISH_S2_BOOK_ID = 'kb-english-4-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G4_ENGLISH_S2_CURRICULUM_BOOK_ID = 'book-english-4-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-4', subject: 'eng', semester: 2 },
  kbBookId: G4_ENGLISH_S2_BOOK_ID,
  browserBookId: G4_ENGLISH_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG4EnglishSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u6 → kbu-g4-eng-s2-nccd-u6). */
export const g4EnglishSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u6_l1 → kbl-g4-eng-s2-nccd-u6_l1). */
export const g4EnglishSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG4EnglishSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG4EnglishSem2Catalog = catalog.buildCatalog;
export const buildG4EnglishSem2BrowserCatalog = catalog.buildBrowserCatalog;
