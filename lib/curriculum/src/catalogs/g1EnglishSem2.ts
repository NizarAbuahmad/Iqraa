/**
 * Grade 1 English (اللغة الإنجليزية) — Semester 2 ("Jordan Team Together"
 * pupil's book, Pearson/York Press). Source of truth:
 * data/iqra_curriculum_g1_english_sem2.json
 *
 * Same shape and source as g1EnglishSem1.ts. This semester's own unnumbered
 * "Welcome: Who's this?" section (unit `u0`) DOES carry a full Grammar and
 * Listening row in the scope-and-sequence table — unlike Semester 1's
 * Welcome section — so it uses the ordinary two-lesson shape.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g1_english_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G1_ENGLISH_S2_BOOK_ID = 'kb-english-1-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G1_ENGLISH_S2_CURRICULUM_BOOK_ID = 'book-english-1-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-1', subject: 'eng', semester: 2 },
  kbBookId: G1_ENGLISH_S2_BOOK_ID,
  browserBookId: G1_ENGLISH_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG1EnglishSem2: NccdCurriculumFile = catalog.curriculum;
export const g1EnglishSem2UnitKbId = catalog.unitKbId;
export const g1EnglishSem2LessonKbId = catalog.lessonKbId;
export const findG1EnglishSem2LessonByKbId = catalog.findLessonByKbId;
export const buildG1EnglishSem2Catalog = catalog.buildCatalog;
export const buildG1EnglishSem2BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G1EnglishSem2Lesson };
