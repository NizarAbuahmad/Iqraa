/**
 * Grade 7 English (اللغة الإنجليزية) — Semester 2 ("Jordan Team Together"
 * student book + teacher guide). Units numbered 5-8, continuing Semester
 * 1's 1-4. Same different-series shape as Semester 1 (see that file's doc
 * comment) — 9 of 12 lessons per unit have a Student Book page, no boxed
 * "I can" statement, teacher-guide "Lesson aims:" used for objectives.
 *
 * Unlike Semester 1, this semester's teacher guide states no period count
 * at all (its one printed table says only which book component each lesson
 * number uses, not its duration) — periods/total_periods are null
 * throughout, a real difference between the two semesters' guides, not an
 * inconsistency. See the JSON's known_gaps.
 */

import raw from '../data/iqra_curriculum_g7_eng_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G7_ENG_S2_BOOK_ID = 'kb-eng-7-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G7_ENG_S2_CURRICULUM_BOOK_ID = 'book-eng-7-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-7', subject: 'eng', semester: 2 },
  kbBookId: G7_ENG_S2_BOOK_ID,
  browserBookId: G7_ENG_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG7EngSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u5 → kbu-g7-eng-s2-nccd-u5). */
export const g7EngSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u5_l1 → kbl-g7-eng-s2-nccd-u5_l1). */
export const g7EngSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG7EngSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG7EngSem2Catalog = catalog.buildCatalog;
export const buildG7EngSem2BrowserCatalog = catalog.buildBrowserCatalog;
