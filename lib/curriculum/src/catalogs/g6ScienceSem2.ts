/**
 * Grade 6 Science (العلوم) — Semester 2 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g6_science_sem2.json
 *
 * Five units numbered 5-9 in the book itself, continuing Semester 1's 1-4
 * rather than restarting — the same convention the Grade 8 science book
 * follows. The JSON unit ids (`u5`…`u9`) mirror those printed numbers, so a
 * KB id reads `kbu-g6-science-s2-nccd-u5` and no unit id collides with its
 * Semester 1 sibling.
 *
 * Same two departures from the Grade 8 book as its Semester 1 half, and one
 * more: `periods` is null for every lesson here (Semester 1 carries a single
 * real value, read from the guide's matrix for u1_l1). See the JSON's
 * `known_gaps`, and g6ScienceSem1.ts for why `objectives` is empty.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g6_science_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G6_SCIENCE_S2_BOOK_ID = 'kb-science-6-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G6_SCIENCE_S2_CURRICULUM_BOOK_ID = 'book-science-6-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-6', subject: 'science', semester: 2 },
  kbBookId: G6_SCIENCE_S2_BOOK_ID,
  browserBookId: G6_SCIENCE_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG6ScienceSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u5 → kbu-g6-science-s2-nccd-u5). */
export const g6ScienceSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u5_l1 → kbl-g6-science-s2-nccd-u5_l1). */
export const g6ScienceSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG6ScienceSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG6ScienceSem2Catalog = catalog.buildCatalog;
export const buildG6ScienceSem2BrowserCatalog = catalog.buildBrowserCatalog;
