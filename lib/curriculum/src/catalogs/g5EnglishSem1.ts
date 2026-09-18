/**
 * Grade 5 English (اللغة الإنجليزية) — Semester 1 ("Jordan Team Together"
 * pupil's book, Pearson/York Press). Source of truth:
 * data/iqra_curriculum_g5_english_sem1.json
 *
 * Built through `makeNccdCatalog` — see `nccdCatalog.ts`.
 *
 * NOT title-only, but unlike g7EngSem1 (12 lessons/unit per the teacher
 * guide's own lesson division), this book's internal per-page lesson
 * numbering could not be reliably reconstructed from the extracted text —
 * see the JSON's `provenance_note`. Instead each unit carries exactly two
 * lessons (Vocabulary & Grammar, Listening & Speaking), both populated with
 * real content — vocabulary lists, grammar points with the book's own
 * example sentences, and skill descriptors — taken from the student book's
 * own two-page "Scope and sequence" table (pp. 4-5), not invented.
 *
 * `main_idea_ar`/`objectives` hold literal English text (the book's own
 * language), matching g7EngSem1's precedent for English-subject books;
 * `title_ar` carries a plain Arabic gloss for search/display only.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g5_english_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G5_ENGLISH_S1_BOOK_ID = 'kb-english-5-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G5_ENGLISH_S1_CURRICULUM_BOOK_ID = 'book-english-5-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-5', subject: 'eng', semester: 1 },
  kbBookId: G5_ENGLISH_S1_BOOK_ID,
  browserBookId: G5_ENGLISH_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG5EnglishSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g5-eng-s1-nccd-u1). */
export const g5EnglishSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g5-eng-s1-nccd-u1_l1). */
export const g5EnglishSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG5EnglishSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG5EnglishSem1Catalog = catalog.buildCatalog;
export const buildG5EnglishSem1BrowserCatalog = catalog.buildBrowserCatalog;
