/**
 * Grade 1 Arabic (اللغة العربية لغتي) — Semester 2.
 * Source of truth: data/iqra_curriculum_g1_arabic_sem2.json
 *
 * Title-only, same reason as g1ArabicSem1.ts. This semester carries a real
 * mid-book transition: unit 6 (مَدْرَسَتِي) still teaches one letter per
 * lesson like every unit in Semester 1; unit 7 (عَلَمُ بِلَادِي) is a
 * transitional unit (adds a الشدة lesson alongside the first أقرأ/أكتب/أبني
 * لغتي lessons); units 8-10 use the fixed 5-lesson-per-unit pattern from
 * g3ArabicSem1/g5ArabicSem1 onward, since the alphabet is complete by then.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g1_arabic_sem2.json' with { type: 'json' };
import { lessonKbPrefix, unitKbPrefix, type CurriculumIdScope } from '../curriculumIds.ts';
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G1_ARABIC_S2_BOOK_ID = 'kb-arabic-1-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G1_ARABIC_S2_CURRICULUM_BOOK_ID = 'book-arabic-1-s2';

const SCOPE: CurriculumIdScope = { gradeId: 'grade-1', subject: 'arabic', semester: 2 };

const catalog = makeNccdCatalog({
  scope: SCOPE,
  kbBookId: G1_ARABIC_S2_BOOK_ID,
  browserBookId: G1_ARABIC_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG1ArabicSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u6 → kbu-g1-arabic-s2-nccd-u6). */
export const g1ArabicSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u6_l1 → kbl-g1-arabic-s2-nccd-u6_l1). */
export const g1ArabicSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG1ArabicSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

/** True for every unit in this book — see the header for why it is unconditional. */
export function isG1ArabicSem2TitleOnlyUnit(unitKbId: string): boolean {
  return unitKbId.startsWith(unitKbPrefix(SCOPE));
}

/** True for every lesson in this book — see the header for why it is unconditional. */
export function isG1ArabicSem2TitleOnlyLesson(kbLessonId: string): boolean {
  return kbLessonId.startsWith(lessonKbPrefix(SCOPE));
}

export const buildG1ArabicSem2Catalog = catalog.buildCatalog;
export const buildG1ArabicSem2BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G1ArabicSem2Lesson };
