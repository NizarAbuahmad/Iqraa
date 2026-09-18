/**
 * Grade 1 Arabic (اللغة العربية لغتي) — Semester 1.
 * Source of truth: data/iqra_curriculum_g1_arabic_sem1.json
 *
 * Title-only for the same reason as g3ArabicSem1/g5ArabicSem1 — see
 * g5ArabicSem1's header for the full rationale. Unlike those books, this
 * one is a letter-teaching primer, not a fixed 5-lesson-per-unit reader:
 * each unit opens with two fixed skill lessons (أستمع بانتباه وتركيز،
 * أتحدث بطلاقة) followed by one lesson per new letter (7-8 lessons per
 * unit in this semester) — no أقرأ/أكتب/أبني لغتي lessons exist yet. See
 * the JSON's `known_gaps` for the mid-book transition in Semester 2.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g1_arabic_sem1.json' with { type: 'json' };
import { lessonKbPrefix, unitKbPrefix, type CurriculumIdScope } from '../curriculumIds.ts';
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G1_ARABIC_S1_BOOK_ID = 'kb-arabic-1-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G1_ARABIC_S1_CURRICULUM_BOOK_ID = 'book-arabic-1-s1';

const SCOPE: CurriculumIdScope = { gradeId: 'grade-1', subject: 'arabic', semester: 1 };

const catalog = makeNccdCatalog({
  scope: SCOPE,
  kbBookId: G1_ARABIC_S1_BOOK_ID,
  browserBookId: G1_ARABIC_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG1ArabicSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g1-arabic-s1-nccd-u1). */
export const g1ArabicSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g1-arabic-s1-nccd-u1_l1). */
export const g1ArabicSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG1ArabicSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

/** True for every unit in this book — see the header for why it is unconditional. */
export function isG1ArabicSem1TitleOnlyUnit(unitKbId: string): boolean {
  return unitKbId.startsWith(unitKbPrefix(SCOPE));
}

/** True for every lesson in this book — see the header for why it is unconditional. */
export function isG1ArabicSem1TitleOnlyLesson(kbLessonId: string): boolean {
  return kbLessonId.startsWith(lessonKbPrefix(SCOPE));
}

export const buildG1ArabicSem1Catalog = catalog.buildCatalog;
export const buildG1ArabicSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G1ArabicSem1Lesson };
