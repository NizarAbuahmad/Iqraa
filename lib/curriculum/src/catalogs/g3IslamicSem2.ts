/**
 * Grade 3 Islamic Education (التربية الإسلامية) — Semester 2 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g3_islamic_sem2.json
 *
 * Same shape as g3IslamicSem1 — see that file for the factory rationale and
 * what this book does and does not print. Units are numbered 5-8, continuing
 * Semester 1's 1-4 rather than restarting, the same convention as
 * g4IslamicSem2/g5IslamicSem2 — the book itself restarts each semester's
 * units at «الوَحْدَةُ الأولى», so the continuous numbering is this project's
 * convention for linking the two semesters, not printed text.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g3_islamic_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G3_ISLAMIC_S2_BOOK_ID = 'kb-islamic-3-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G3_ISLAMIC_S2_CURRICULUM_BOOK_ID = 'book-islamic-3-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-3', subject: 'islamic', semester: 2 },
  kbBookId: G3_ISLAMIC_S2_BOOK_ID,
  browserBookId: G3_ISLAMIC_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG3IslamicSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u5 → kbu-g3-islamic-s2-nccd-u5). */
export const g3IslamicSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u5_l1 → kbl-g3-islamic-s2-nccd-u5_l1). */
export const g3IslamicSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG3IslamicSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG3IslamicSem2Catalog = catalog.buildCatalog;
export const buildG3IslamicSem2BrowserCatalog = catalog.buildBrowserCatalog;
