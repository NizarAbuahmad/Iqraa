/**
 * Grade 9 Earth and Environmental Science (علوم الأرض والبيئة) — Semester 2.
 * Source of truth: data/iqra_curriculum_g9_earth_science_sem2.json
 *
 * Mirrors g9EarthScienceSem1.ts. Three units here, numbered 3, 4 and 5 —
 * numbering runs across both semesters, read off the printed opener pages.
 *
 * **Four of this book's six lesson-opener boxes extract interleaved**: a word
 * is split and its pieces reordered within the line, so «أَصِفُ طبقاتِ الغلافِ
 * الجويِّ وخصائصَها» comes out as «ِفُ طبقاتِ الغلافِ الجويِّ وخصائصَهاًص- أ».
 * That is the same column artifact the Grade 9 biology S2 book carries, and
 * the JSON's `known_gaps` records which pages it affects and that the text was
 * rebuilt piece by piece rather than guessed. It is NOT the whole-run reversal
 * that got Arabic S2 and both financial-literacy books refused — that damage
 * leaves nothing legible to rebuild from.
 *
 * Periods are null; this semester's teacher guide is on disk but unregistered.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g9_earth_science_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G9_EARTHSCIENCE_S2_BOOK_ID = 'kb-earth-science-9-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G9_EARTHSCIENCE_S2_CURRICULUM_BOOK_ID = 'book-earth-science-9-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-9', subject: 'earth-science', semester: 2 },
  kbBookId: G9_EARTHSCIENCE_S2_BOOK_ID,
  browserBookId: G9_EARTHSCIENCE_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG9EarthScienceSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u3 → kbu-g9-earth-science-s2-nccd-u3). */
export const g9EarthScienceSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u3_l1 → kbl-g9-earth-science-s2-nccd-u3_l1). */
export const g9EarthScienceSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG9EarthScienceSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG9EarthScienceSem2Catalog = catalog.buildCatalog;
export const buildG9EarthScienceSem2BrowserCatalog = catalog.buildBrowserCatalog;
