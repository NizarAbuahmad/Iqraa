/**
 * Grade 9 Biology (العلوم الحياتية) — Semester 1 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g9_biology_sem1.json
 *
 * Built through `makeNccdCatalog` — see `nccdCatalog.ts`.
 *
 * The subject slug is `biology`, not `bio`. `bio-` is only the Grade 10 tag
 * stem; the slug inside an id is the SUBJECTS key in curriculumIds.ts, and the
 * two are not interchangeable. So the tag here is `g9-biology-s1`, and
 * `g9-bio-s1` would match no unit and ground nothing.
 *
 * Periods are null — no Grade 9 biology teacher guide for semester 1 is on
 * disk. Outcomes and vocabulary are present, printed per lesson opener.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g9_biology_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G9_BIOLOGY_S1_BOOK_ID = 'kb-biology-9-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G9_BIOLOGY_S1_CURRICULUM_BOOK_ID = 'book-biology-9-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-9', subject: 'biology', semester: 1 },
  kbBookId: G9_BIOLOGY_S1_BOOK_ID,
  browserBookId: G9_BIOLOGY_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG9BiologySem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g9-biology-s1-nccd-u1). */
export const g9BiologySem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g9-biology-s1-nccd-u1_l1). */
export const g9BiologySem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG9BiologySem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG9BiologySem1Catalog = catalog.buildCatalog;
export const buildG9BiologySem1BrowserCatalog = catalog.buildBrowserCatalog;
