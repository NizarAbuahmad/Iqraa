/**
 * Grade 5 Arabic (اللغة العربية لغتي) — Semester 1.
 * Source of truth: data/iqra_curriculum_g5_arabic_sem1.json
 *
 * Title-only for a different reason than g5SocialSem1: this book's PDF
 * extracts cleanly through PyMuPDF — no corrupted CMap. It is title-only
 * because the content itself doesn't reduce to a prose summary the way
 * Math/Science/Islamic Education's lessons do. Every unit is five lessons
 * of the same fixed pattern (أستمع، أتحدث، أقرأ، أكتب، أبني لغتي), and every
 * lesson is a page of interactive exercises (multiple choice, matching,
 * fill-in-the-blank) around a literary or grammar topic, not an expository
 * passage. The "unit competencies" printed on each unit's opener page are a
 * near-identical skills checklist repeated unit to unit (aural recall,
 * comprehension, appreciation, etc.) — not lesson-specific content, so they
 * would not make useful `objectives`. Lesson titles here carry both the
 * fixed lesson-type name and its literary/grammar topic (in parentheses),
 * exactly as the book's own contents page prints them.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g5_arabic_sem1.json' with { type: 'json' };
import { lessonKbPrefix, unitKbPrefix, type CurriculumIdScope } from '../curriculumIds.ts';
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G5_ARABIC_S1_BOOK_ID = 'kb-arabic-5-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G5_ARABIC_S1_CURRICULUM_BOOK_ID = 'book-arabic-5-s1';

const SCOPE: CurriculumIdScope = { gradeId: 'grade-5', subject: 'arabic', semester: 1 };

const catalog = makeNccdCatalog({
  scope: SCOPE,
  kbBookId: G5_ARABIC_S1_BOOK_ID,
  browserBookId: G5_ARABIC_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG5ArabicSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g5-arabic-s1-nccd-u1). */
export const g5ArabicSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g5-arabic-s1-nccd-u1_l1). */
export const g5ArabicSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG5ArabicSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

/** True for every unit in this book — see the header for why it is unconditional. */
export function isG5ArabicSem1TitleOnlyUnit(unitKbId: string): boolean {
  return unitKbId.startsWith(unitKbPrefix(SCOPE));
}

/** True for every lesson in this book — see the header for why it is unconditional. */
export function isG5ArabicSem1TitleOnlyLesson(kbLessonId: string): boolean {
  return kbLessonId.startsWith(lessonKbPrefix(SCOPE));
}

export const buildG5ArabicSem1Catalog = catalog.buildCatalog;
export const buildG5ArabicSem1BrowserCatalog = catalog.buildBrowserCatalog;
