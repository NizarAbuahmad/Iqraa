/**
 * Grade 9 English (اللغة الإنجليزية) — Semester 1 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g9_eng_sem1.json
 *
 * Built through `makeNccdCatalog` — see `nccdCatalog.ts`.
 *
 * ## Seven lessons per unit, not one
 *
 * The Grade 10 English files ship ONE lesson per unit at scope-and-sequence
 * depth, and their `provenance_note` gives the reason: the book names its
 * seven slots only by skill banner, so "a seven-lesson breakdown could not be
 * derived without guessing which slot a page belongs to."
 *
 * That is true of that book and not of this one. The Grade 9 book prints
 * exactly one `□ I can …` statement per lesson, 35 per semester — five units
 * of seven — so lesson numbering follows the order of those statements within
 * a unit rather than a guess about pages. The generator refuses to emit if any
 * unit yields other than seven, and refuses again if a matched `LESSON nA`
 * header disagrees with the ordinal it landed on.
 *
 * ## Arabic here is translated, not printed
 *
 * The book is English-only beyond its cover. Unit titles and skill banners are
 * our translations; topic labels and every `I can` outcome are kept verbatim
 * in English, because translating an outcome changes what a teacher is told
 * the lesson delivers. Same treatment the Grade 10 English and the four
 * vocational English catalogs record for the same reason.
 *
 * Vocabulary is empty: this book scatters words through the exercises and a
 * `Word List` at the back rather than printing a terms box on the lesson
 * opener. Periods are null — both teacher guides are on disk but unregistered.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g9_eng_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G9_ENG_S1_BOOK_ID = 'kb-eng-9-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G9_ENG_S1_CURRICULUM_BOOK_ID = 'book-eng-9-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-9', subject: 'eng', semester: 1 },
  kbBookId: G9_ENG_S1_BOOK_ID,
  browserBookId: G9_ENG_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG9EngSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g9-eng-s1-nccd-u1). */
export const g9EngSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g9-eng-s1-nccd-u1_l1). */
export const g9EngSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG9EngSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG9EngSem1Catalog = catalog.buildCatalog;
export const buildG9EngSem1BrowserCatalog = catalog.buildBrowserCatalog;
