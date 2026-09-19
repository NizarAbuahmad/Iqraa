/**
 * Grade 2 English (اللغة الإنجليزية) — Semester 1 ("Jordan Team Together"
 * pupil's book, Pearson/York Press). Source of truth:
 * data/iqra_curriculum_g2_english_sem1.json
 *
 * Same shape as g1EnglishSem1/g4EnglishSem1/g5EnglishSem1 — each numbered
 * unit carries two lessons (Vocabulary & Grammar, Listening & Speaking),
 * real content taken from the student book's own "Scope and sequence" table
 * (pp. 4-5). The unnumbered "Welcome: Hello!" section is modeled as unit
 * `u0`; unlike g1EnglishSem1.ts's Welcome unit, this one DOES carry a full
 * Grammar and Listening row in the table, so it uses the same two-lesson
 * shape as every numbered unit — see the JSON's `known_gaps`.
 *
 * `main_idea_ar`/`objectives` hold literal English text, matching the
 * established English-subject precedent; `title_ar` is a plain Arabic gloss.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g2_english_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G2_ENGLISH_S1_BOOK_ID = 'kb-english-2-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G2_ENGLISH_S1_CURRICULUM_BOOK_ID = 'book-english-2-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-2', subject: 'eng', semester: 1 },
  kbBookId: G2_ENGLISH_S1_BOOK_ID,
  browserBookId: G2_ENGLISH_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG2EnglishSem1: NccdCurriculumFile = catalog.curriculum;
export const g2EnglishSem1UnitKbId = catalog.unitKbId;
export const g2EnglishSem1LessonKbId = catalog.lessonKbId;
export const findG2EnglishSem1LessonByKbId = catalog.findLessonByKbId;
export const buildG2EnglishSem1Catalog = catalog.buildCatalog;
export const buildG2EnglishSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G2EnglishSem1Lesson };
