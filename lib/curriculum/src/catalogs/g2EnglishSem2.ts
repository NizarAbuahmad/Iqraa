/**
 * Grade 2 English (اللغة الإنجليزية) — Semester 2 ("Jordan Team Together"
 * pupil's book, Pearson/York Press). Source of truth:
 * data/iqra_curriculum_g2_english_sem2.json
 *
 * Same treatment as g2EnglishSem1.ts: unit titles, page numbers, vocabulary,
 * grammar phrases, and listening skill descriptors taken from the book's own
 * "Scope and sequence" table (pp. 4-5). Units are numbered 5-8, continuing
 * Semester 1's own numbering. The Welcome unit here reviews Semester 1's
 * vocabulary, so its Vocabulary & Grammar lesson carries no `vocabulary`
 * entries (the table lists category labels only, not individual words) —
 * see the JSON's `known_gaps`.
 *
 * `main_idea_ar`/`objectives` hold literal English text, matching the
 * established English-subject precedent; `title_ar` is a plain Arabic gloss.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g2_english_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G2_ENGLISH_S2_BOOK_ID = 'kb-english-2-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G2_ENGLISH_S2_CURRICULUM_BOOK_ID = 'book-english-2-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-2', subject: 'eng', semester: 2 },
  kbBookId: G2_ENGLISH_S2_BOOK_ID,
  browserBookId: G2_ENGLISH_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG2EnglishSem2: NccdCurriculumFile = catalog.curriculum;
export const g2EnglishSem2UnitKbId = catalog.unitKbId;
export const g2EnglishSem2LessonKbId = catalog.lessonKbId;
export const findG2EnglishSem2LessonByKbId = catalog.findLessonByKbId;
export const buildG2EnglishSem2Catalog = catalog.buildCatalog;
export const buildG2EnglishSem2BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G2EnglishSem2Lesson };
