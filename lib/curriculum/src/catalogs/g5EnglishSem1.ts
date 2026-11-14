/**
 * Grade 5 English (اللغة الإنجليزية) — Semester 1 ("Jordan Team Together"
 * pupil's book, Pearson/York Press). Source of truth:
 * data/iqra_curriculum_g5_english_sem1.json
 *
 * Built through `makeNccdCatalog` — see `nccdCatalog.ts`.
 *
 * Every unit carries the book's own lessons, as the teacher's guide divides
 * them (since 2026-11-13; until then each unit was two lessons, «Vocabulary &
 * Grammar» and «Listening & Speaking»): Welcome back has 3, each main unit 12.
 * `order` is the book's lesson number; the ids are not, because u*_l1 and
 * u*_l2 were already persisted — u*_l1 is book Lesson 1 and keeps the unit's
 * whole word list (the English corner lesson, which the Grade 5 grammar unit
 * is keyed on), u*_l2 is Lesson 12 (Welcome back: Lesson 3), and u*_l3…l12
 * are Lessons 2–11. See the JSON's `known_gaps`.
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
