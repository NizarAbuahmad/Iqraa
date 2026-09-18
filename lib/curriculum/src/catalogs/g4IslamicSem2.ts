/**
 * Grade 4 Islamic Education (التربية الإسلامية) — Semester 2 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g4_islamic_sem2.json
 *
 * Same shape as g4IslamicSem1 — see that file for the factory rationale and
 * what this book does and does not print. Units are numbered 5-8, continuing
 * Semester 1's 1-4 rather than restarting, the same convention as
 * g5IslamicSem2 — the book itself restarts each semester's units at
 * «الوَحْدَةُ الأولى», so the continuous numbering is this project's
 * convention for linking the two semesters, not printed text.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g4_islamic_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G4_ISLAMIC_S2_BOOK_ID = 'kb-islamic-4-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G4_ISLAMIC_S2_CURRICULUM_BOOK_ID = 'book-islamic-4-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-4', subject: 'islamic', semester: 2 },
  kbBookId: G4_ISLAMIC_S2_BOOK_ID,
  browserBookId: G4_ISLAMIC_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG4IslamicSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u5 → kbu-g4-islamic-s2-nccd-u5). */
export const g4IslamicSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u5_l1 → kbl-g4-islamic-s2-nccd-u5_l1). */
export const g4IslamicSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG4IslamicSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG4IslamicSem2Catalog = catalog.buildCatalog;
export const buildG4IslamicSem2BrowserCatalog = catalog.buildBrowserCatalog;
