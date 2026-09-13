/**
 * Grade 9 Biology (العلوم الحياتية) — Semester 2 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g9_biology_sem2.json
 *
 * Mirrors g9BiologySem1.ts, including the slug trap: it is `biology`, not the
 * Grade 10 tag stem `bio`.
 *
 * Units are numbered 3 and 4 — numbering runs across both semesters, read off
 * the printed opener pages. Periods are null even though this semester's
 * teacher guide IS on disk; it was left unregistered in the breadth pass.
 *
 * This book's extraction carries the highest word-transposition rate of the
 * accepted Grade 9 set (34.5%), from column reordering rather than damage.
 * The opener pages transcribed here were read by eye before being trusted.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g9_biology_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G9_BIOLOGY_S2_BOOK_ID = 'kb-biology-9-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G9_BIOLOGY_S2_CURRICULUM_BOOK_ID = 'book-biology-9-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-9', subject: 'biology', semester: 2 },
  kbBookId: G9_BIOLOGY_S2_BOOK_ID,
  browserBookId: G9_BIOLOGY_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG9BiologySem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u3 → kbu-g9-biology-s2-nccd-u3). */
export const g9BiologySem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u3_l1 → kbl-g9-biology-s2-nccd-u3_l1). */
export const g9BiologySem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG9BiologySem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG9BiologySem2Catalog = catalog.buildCatalog;
export const buildG9BiologySem2BrowserCatalog = catalog.buildBrowserCatalog;
