/**
 * Grade 9 Earth and Environmental Science (علوم الأرض والبيئة) — Semester 1.
 * Source of truth: data/iqra_curriculum_g9_earth_science_sem1.json
 *
 * Built through `makeNccdCatalog` — see `nccdCatalog.ts`.
 *
 * The subject slug is `earth-science`, not the Grade 10 tag stem `earth`, so
 * the tag is `g9-earth-science-s1`. Same trap as biology's `biology` vs `bio`.
 *
 * Periods are null — no Grade 9 earth science teacher guide for semester 1 is
 * on disk. Outcomes and vocabulary are present, printed per lesson opener.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g9_earth_science_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G9_EARTHSCIENCE_S1_BOOK_ID = 'kb-earth-science-9-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G9_EARTHSCIENCE_S1_CURRICULUM_BOOK_ID = 'book-earth-science-9-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-9', subject: 'earth-science', semester: 1 },
  kbBookId: G9_EARTHSCIENCE_S1_BOOK_ID,
  browserBookId: G9_EARTHSCIENCE_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG9EarthScienceSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g9-earth-science-s1-nccd-u1). */
export const g9EarthScienceSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g9-earth-science-s1-nccd-u1_l1). */
export const g9EarthScienceSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG9EarthScienceSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG9EarthScienceSem1Catalog = catalog.buildCatalog;
export const buildG9EarthScienceSem1BrowserCatalog = catalog.buildBrowserCatalog;
