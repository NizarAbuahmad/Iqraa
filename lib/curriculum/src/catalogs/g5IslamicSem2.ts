/**
 * Grade 5 Islamic Education (التربية الإسلامية) — Semester 2 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g5_islamic_sem2.json
 *
 * Same shape as g5IslamicSem1 — see that file for the factory rationale and
 * what this book does and does not print. Units are numbered 5-8, continuing
 * Semester 1's 1-4 rather than restarting, the same convention as this
 * grade's science books — the book itself restarts each semester's units at
 * «الوَحْدَةُ الأولى», so the continuous numbering is this project's
 * convention for linking the two semesters, not printed text.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g5_islamic_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G5_ISLAMIC_S2_BOOK_ID = 'kb-islamic-5-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G5_ISLAMIC_S2_CURRICULUM_BOOK_ID = 'book-islamic-5-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-5', subject: 'islamic', semester: 2 },
  kbBookId: G5_ISLAMIC_S2_BOOK_ID,
  browserBookId: G5_ISLAMIC_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG5IslamicSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u5 → kbu-g5-islamic-s2-nccd-u5). */
export const g5IslamicSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u5_l1 → kbl-g5-islamic-s2-nccd-u5_l1). */
export const g5IslamicSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG5IslamicSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG5IslamicSem2Catalog = catalog.buildCatalog;
export const buildG5IslamicSem2BrowserCatalog = catalog.buildBrowserCatalog;
