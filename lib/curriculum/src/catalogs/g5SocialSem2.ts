/**
 * Grade 5 Social Studies (الدراسات الاجتماعية) — Semester 2.
 * Source of truth: data/iqra_curriculum_g5_social_sem2.json
 *
 * Title-only for the same reason as g5SocialSem1: a corrupted ToUnicode CMap
 * in this book's PDF, not an extraction-order bug — see that file's header
 * for the full explanation. Unit and lesson titles here were recovered by
 * OCR of the contents pages and unit opener pages. Units are numbered 5-8,
 * continuing Semester 1's 1-4, matching the book's own cover and contents
 * page. Unit 8 ("الثَّقافَةُ وَالتُّراثُ") carries the lowest confidence in
 * this file — see the JSON's `known_gaps`.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g5_social_sem2.json' with { type: 'json' };
import { lessonKbPrefix, unitKbPrefix, type CurriculumIdScope } from '../curriculumIds.ts';
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G5_SOCIAL_S2_BOOK_ID = 'kb-social-5-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G5_SOCIAL_S2_CURRICULUM_BOOK_ID = 'book-social-5-s2';

const SCOPE: CurriculumIdScope = { gradeId: 'grade-5', subject: 'social', semester: 2 };

const catalog = makeNccdCatalog({
  scope: SCOPE,
  kbBookId: G5_SOCIAL_S2_BOOK_ID,
  browserBookId: G5_SOCIAL_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG5SocialSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u5 → kbu-g5-social-s2-nccd-u5). */
export const g5SocialSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u5_l1 → kbl-g5-social-s2-nccd-u5_l1). */
export const g5SocialSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG5SocialSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

/** True for every unit in this book — see the header for why it is unconditional. */
export function isG5SocialSem2TitleOnlyUnit(unitKbId: string): boolean {
  return unitKbId.startsWith(unitKbPrefix(SCOPE));
}

/** True for every lesson in this book — see the header for why it is unconditional. */
export function isG5SocialSem2TitleOnlyLesson(kbLessonId: string): boolean {
  return kbLessonId.startsWith(lessonKbPrefix(SCOPE));
}

export const buildG5SocialSem2Catalog = catalog.buildCatalog;
export const buildG5SocialSem2BrowserCatalog = catalog.buildBrowserCatalog;
