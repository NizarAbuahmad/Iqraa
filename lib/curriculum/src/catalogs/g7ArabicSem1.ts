/**
 * Grade 7 Arabic (اللغة العربية لغتي) — Semester 1 (NCCD student book +
 * teacher guide). Source of truth: data/iqra_curriculum_g7_arabic_sem1.json
 *
 * Built through `makeNccdCatalog` — mirrors g8ArabicSem1.ts: five units,
 * five lessons apiece (one per language strand — الاستماع، التحدُّث،
 * القراءة، الكتابة، البناء اللغوي). Objectives are the numbered «كفايات»
 * items printed on each unit's «كفايات الوحدة» page, copied verbatim.
 *
 * Unlike the Grade 8 precedent, this semester's teacher guide DOES supply
 * real periods for most lessons (Listening/Speaking/Writing/Grammar have a
 * fixed count; Reading prints a range "3-4" rather than a single number, so
 * it stays null rather than guessed — see the JSON's known_gaps). Vocabulary
 * stays empty: this book's only word-support box is a same-language
 * (Arabic-to-Arabic) glossary, not a bilingual terms box.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g7_arabic_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G7_ARABIC_S1_BOOK_ID = 'kb-arabic-7-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G7_ARABIC_S1_CURRICULUM_BOOK_ID = 'book-arabic-7-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-7', subject: 'arabic', semester: 1 },
  kbBookId: G7_ARABIC_S1_BOOK_ID,
  browserBookId: G7_ARABIC_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG7ArabicSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g7-arabic-s1-nccd-u1). */
export const g7ArabicSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g7-arabic-s1-nccd-u1_l1). */
export const g7ArabicSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG7ArabicSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG7ArabicSem1Catalog = catalog.buildCatalog;
export const buildG7ArabicSem1BrowserCatalog = catalog.buildBrowserCatalog;
