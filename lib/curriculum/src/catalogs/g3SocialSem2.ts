/**
 * Grade 3 Social Studies (الدراسات الاجتماعية) — Semester 2 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g3_social_sem2.json
 *
 * Same shape as g3SocialSem1 — see that file for the factory rationale.
 * Units are numbered 4-6, continuing Semester 1's 1-3 — printed text in the
 * book itself (each unit opener prints its own "4"/"5"/"6"), same as
 * g4SocialSem2. Unlike Semester 1, this book's PDF extracts cleanly with no
 * reversed/presentation-form glyphs.
 *
 * Only the nine numbered lessons are carried, matching the printed table of
 * contents: 3 units, 4+3+2 lessons.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g3_social_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G3_SOCIAL_S2_BOOK_ID = 'kb-social-3-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G3_SOCIAL_S2_CURRICULUM_BOOK_ID = 'book-social-3-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-3', subject: 'social', semester: 2 },
  kbBookId: G3_SOCIAL_S2_BOOK_ID,
  browserBookId: G3_SOCIAL_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG3SocialSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u4 → kbu-g3-social-s2-nccd-u4). */
export const g3SocialSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u4_l1 → kbl-g3-social-s2-nccd-u4_l1). */
export const g3SocialSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG3SocialSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG3SocialSem2Catalog = catalog.buildCatalog;
export const buildG3SocialSem2BrowserCatalog = catalog.buildBrowserCatalog;
