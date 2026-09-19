/**
 * Grade 2 Arabic (اللغة العربية لغتي) — Semester 2.
 * Source of truth: data/iqra_curriculum_g2_arabic_sem2.json
 *
 * Title-only, same as g2ArabicSem1.ts. Units continue the book's own
 * numbering (6-10). Unlike Semester 1's table of contents, this semester's
 * own contents page proved unreliable for mapping each lesson group to its
 * unit (column-jumbling) — the JSON's structure was built by reading each
 * unit/lesson opener page directly instead; see the JSON's `provenance_note`.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g2_arabic_sem2.json' with { type: 'json' };
import { lessonKbPrefix, unitKbPrefix, type CurriculumIdScope } from '../curriculumIds.ts';
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G2_ARABIC_S2_BOOK_ID = 'kb-arabic-2-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G2_ARABIC_S2_CURRICULUM_BOOK_ID = 'book-arabic-2-s2';

const SCOPE: CurriculumIdScope = { gradeId: 'grade-2', subject: 'arabic', semester: 2 };

const catalog = makeNccdCatalog({
  scope: SCOPE,
  kbBookId: G2_ARABIC_S2_BOOK_ID,
  browserBookId: G2_ARABIC_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG2ArabicSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u6 → kbu-g2-arabic-s2-nccd-u6). */
export const g2ArabicSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u6_l1 → kbl-g2-arabic-s2-nccd-u6_l1). */
export const g2ArabicSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG2ArabicSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

/** True for every unit in this book — see the header for why it is unconditional. */
export function isG2ArabicSem2TitleOnlyUnit(unitKbId: string): boolean {
  return unitKbId.startsWith(unitKbPrefix(SCOPE));
}

/** True for every lesson in this book — see the header for why it is unconditional. */
export function isG2ArabicSem2TitleOnlyLesson(kbLessonId: string): boolean {
  return kbLessonId.startsWith(lessonKbPrefix(SCOPE));
}

export const buildG2ArabicSem2Catalog = catalog.buildCatalog;
export const buildG2ArabicSem2BrowserCatalog = catalog.buildBrowserCatalog;
