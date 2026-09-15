/**
 * Grade 6 Arabic (العربية لغتي) — Semester 2 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g6_arabic_sem2.json
 *
 * Five units numbered 6-10, continuing Semester 1's 1-5 rather than restarting
 * — the same convention the Grade 6 and Grade 8 science books follow. The JSON
 * unit ids (`u6`…`u10`) mirror those printed numbers, so a KB id reads
 * `kbu-g6-arabic-s2-nccd-u6` and cannot collide with its Semester 1 sibling.
 *
 * Title-only for the same reason as Semester 1 — see g6ArabicSem1.ts's header
 * for what this book does and does not print, and why the predicates below are
 * unconditional rather than a `data_tier` lookup.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g6_arabic_sem2.json' with { type: 'json' };
import { lessonKbPrefix, unitKbPrefix, type CurriculumIdScope } from '../curriculumIds.ts';
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G6_ARABIC_S2_BOOK_ID = 'kb-arabic-6-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G6_ARABIC_S2_CURRICULUM_BOOK_ID = 'book-arabic-6-s2';

const SCOPE: CurriculumIdScope = { gradeId: 'grade-6', subject: 'arabic', semester: 2 };

const catalog = makeNccdCatalog({
  scope: SCOPE,
  kbBookId: G6_ARABIC_S2_BOOK_ID,
  browserBookId: G6_ARABIC_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG6ArabicSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u6 → kbu-g6-arabic-s2-nccd-u6). */
export const g6ArabicSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u6_l1 → kbl-g6-arabic-s2-nccd-u6_l1). */
export const g6ArabicSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG6ArabicSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

/** True for every unit in this book — see g6ArabicSem1.ts for why. */
export function isG6ArabicSem2TitleOnlyUnit(unitKbId: string): boolean {
  return unitKbId.startsWith(unitKbPrefix(SCOPE));
}

/** True for every lesson in this book — see g6ArabicSem1.ts for why. */
export function isG6ArabicSem2TitleOnlyLesson(kbLessonId: string): boolean {
  return kbLessonId.startsWith(lessonKbPrefix(SCOPE));
}

export const buildG6ArabicSem2Catalog = catalog.buildCatalog;
export const buildG6ArabicSem2BrowserCatalog = catalog.buildBrowserCatalog;
