/**
 * Grade 9 Arabic (اللغة العربية لغتي) — Semester 1 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g9_arabic_sem1.json
 *
 * Built through `makeNccdCatalog` — see `nccdCatalog.ts` — even though this
 * book's own structure has no «الفكرةُ الرئيسةُ» or «نتاجاتُ التعلُّمِ» boxes.
 * The shape still fits: five units, five lessons apiece (one per language
 * strand — الاستماع، التحدُّث، القراءة، الكتابة، البناء اللغوي), each with a
 * title and a list of objectives. Only the SOURCE of those fields differs from
 * the science books — see the JSON's `provenance_note` for exactly where each
 * one was read.
 *
 * **Every title in this file was read from a page image, not from the
 * extracted text.** Unit 5's title («نَحْوَ المُسْتَقْبَلِ المِهْنِيِّ») is set in a
 * decorative font and produced nothing usable in the extraction — the same
 * failure mode `g10DigitalSem1.ts` documents for a different book's outcomes
 * box. Rather than transcribe the other four units from text and risk the
 * same trap going unnoticed, all five were read from images.
 *
 * Objectives are the numbered «كفايات» items printed on each unit's
 * «كفايات الوحدة» page — copied verbatim, not summarised. Numbering in the
 * book sometimes skips (Writing starts at item 2, not 1, in every unit but
 * the first), and that gap is the book's own, not a dropped item.
 *
 * Periods are null: no teacher guide for this semester is on disk. Vocabulary
 * is empty: this book prints no bilingual terms box — it is a monolingual
 * Arabic text, unlike the English books this pattern also covers.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g9_arabic_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G9_ARABIC_S1_BOOK_ID = 'kb-arabic-9-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G9_ARABIC_S1_CURRICULUM_BOOK_ID = 'book-arabic-9-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-9', subject: 'arabic', semester: 1 },
  kbBookId: G9_ARABIC_S1_BOOK_ID,
  browserBookId: G9_ARABIC_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG9ArabicSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g9-arabic-s1-nccd-u1). */
export const g9ArabicSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g9-arabic-s1-nccd-u1_l1). */
export const g9ArabicSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG9ArabicSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG9ArabicSem1Catalog = catalog.buildCatalog;
export const buildG9ArabicSem1BrowserCatalog = catalog.buildBrowserCatalog;
