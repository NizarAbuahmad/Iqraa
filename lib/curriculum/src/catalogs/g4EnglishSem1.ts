/**
 * Grade 4 English (اللغة الإنجليزية) — Semester 1 ("Jordan Team Together"
 * pupil's book, Pearson/York Press). Source of truth:
 * data/iqra_curriculum_g4_english_sem1.json
 *
 * Not title-only, same shape as g5EnglishSem1 — see that file's header for
 * the two-lessons-per-unit (Vocabulary & Grammar, Listening & Speaking)
 * rationale.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g4_english_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G4_ENGLISH_S1_BOOK_ID = 'kb-english-4-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G4_ENGLISH_S1_CURRICULUM_BOOK_ID = 'book-english-4-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-4', subject: 'eng', semester: 1 },
  kbBookId: G4_ENGLISH_S1_BOOK_ID,
  browserBookId: G4_ENGLISH_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG4EnglishSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g4-eng-s1-nccd-u1). */
export const g4EnglishSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g4-eng-s1-nccd-u1_l1). */
export const g4EnglishSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG4EnglishSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG4EnglishSem1Catalog = catalog.buildCatalog;
export const buildG4EnglishSem1BrowserCatalog = catalog.buildBrowserCatalog;
