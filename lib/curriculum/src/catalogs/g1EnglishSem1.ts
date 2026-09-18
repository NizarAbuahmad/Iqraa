/**
 * Grade 1 English (اللغة الإنجليزية) — Semester 1 ("Jordan Team Together"
 * pupil's book, Pearson/York Press). Source of truth:
 * data/iqra_curriculum_g1_english_sem1.json
 *
 * Same shape as g4EnglishSem1/g5EnglishSem1 — each numbered unit carries two
 * lessons (Vocabulary & Grammar, Listening & Speaking), real content taken
 * from the student book's own "Scope and sequence" table (pp. 4-5). The
 * unnumbered "Welcome: Hello!" section is modeled as unit `u0` and carries
 * only one lesson (no Grammar/Listening row exists for it in this semester's
 * table — see the JSON's `known_gaps`).
 *
 * `main_idea_ar`/`objectives` hold literal English text, matching the
 * established English-subject precedent; `title_ar` is a plain Arabic gloss.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g1_english_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G1_ENGLISH_S1_BOOK_ID = 'kb-english-1-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G1_ENGLISH_S1_CURRICULUM_BOOK_ID = 'book-english-1-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-1', subject: 'eng', semester: 1 },
  kbBookId: G1_ENGLISH_S1_BOOK_ID,
  browserBookId: G1_ENGLISH_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG1EnglishSem1: NccdCurriculumFile = catalog.curriculum;
export const g1EnglishSem1UnitKbId = catalog.unitKbId;
export const g1EnglishSem1LessonKbId = catalog.lessonKbId;
export const findG1EnglishSem1LessonByKbId = catalog.findLessonByKbId;
export const buildG1EnglishSem1Catalog = catalog.buildCatalog;
export const buildG1EnglishSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G1EnglishSem1Lesson };
