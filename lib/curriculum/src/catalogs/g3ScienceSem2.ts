/**
 * Grade 3 Science (العلوم) — Semester 2 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g3_science_sem2.json
 *
 * Built through `makeNccdCatalog` — same shape as g3ScienceSem1. Unit numbers
 * (4, 5, 6) continue the printed numbering from Semester 1 (1-3), matching the
 * book's own table of contents. `objectives` and `prior_knowledge` are empty
 * throughout, same reason as Semester 1.
 *
 * Unit 4 (المادة) in this book repeats Semester 1's Unit 2 title, lesson
 * titles, and content almost verbatim — verified against the PDF directly,
 * not an extraction artefact; see the JSON's known_gaps.
 *
 * Only the six numbered lessons are carried, matching the printed table of
 * contents exactly: 3 units, 2+2+2 lessons. «الإثْراءُ وَالتَّوَسُّعُ» and
 * «مُراجَعَةُ الوَحْدَةِ» are absent — the book gives them no lesson number.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g3_science_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G3_SCIENCE_S2_BOOK_ID = 'kb-science-3-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G3_SCIENCE_S2_CURRICULUM_BOOK_ID = 'book-science-3-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-3', subject: 'science', semester: 2 },
  kbBookId: G3_SCIENCE_S2_BOOK_ID,
  browserBookId: G3_SCIENCE_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG3ScienceSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u4 → kbu-g3-science-s2-nccd-u4). */
export const g3ScienceSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u4_l1 → kbl-g3-science-s2-nccd-u4_l1). */
export const g3ScienceSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG3ScienceSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG3ScienceSem2Catalog = catalog.buildCatalog;
export const buildG3ScienceSem2BrowserCatalog = catalog.buildBrowserCatalog;
