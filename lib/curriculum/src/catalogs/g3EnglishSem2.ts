/**
 * Grade 3 English (اللغة الإنجليزية) — Semester 2 ("Jordan Team Together"
 * pupil's book, Pearson/York Press). Source of truth:
 * data/iqra_curriculum_g3_english_sem2.json
 *
 * Same shape as g3EnglishSem1 — see that file's header. Unlike Semester 1,
 * this semester has a real pupil's book. Units are numbered 6-10, continuing
 * Semester 1's 1-5 — this project's own linking convention (the book itself
 * only numbers 4 of its 5 units, leaving the Welcome unit unnumbered).
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g3_english_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G3_ENGLISH_S2_BOOK_ID = 'kb-english-3-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G3_ENGLISH_S2_CURRICULUM_BOOK_ID = 'book-english-3-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-3', subject: 'eng', semester: 2 },
  kbBookId: G3_ENGLISH_S2_BOOK_ID,
  browserBookId: G3_ENGLISH_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG3EnglishSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u6 → kbu-g3-eng-s2-nccd-u6). */
export const g3EnglishSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u6_l1 → kbl-g3-eng-s2-nccd-u6_l1). */
export const g3EnglishSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG3EnglishSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG3EnglishSem2Catalog = catalog.buildCatalog;
export const buildG3EnglishSem2BrowserCatalog = catalog.buildBrowserCatalog;
