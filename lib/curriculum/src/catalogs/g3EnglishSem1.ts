/**
 * Grade 3 English (اللغة الإنجليزية) — Semester 1 ("Jordan Team Together"
 * teacher's book, Pearson/York Press — no pupil's book was supplied for this
 * semester). Source of truth: data/iqra_curriculum_g3_english_sem1.json
 *
 * Not title-only, same shape as g5EnglishSem1 — see that file's header for
 * the two-lessons-per-unit (Vocabulary & Grammar, Listening & Speaking)
 * rationale. Unlike g5EnglishSem1, this semester's source is the Teacher's
 * Book (no pupil's book exists for Grade 3 Semester 1) — real content still
 * comes from the book's own "Scope and sequence" table, same technique.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g3_english_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G3_ENGLISH_S1_BOOK_ID = 'kb-english-3-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G3_ENGLISH_S1_CURRICULUM_BOOK_ID = 'book-english-3-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-3', subject: 'eng', semester: 1 },
  kbBookId: G3_ENGLISH_S1_BOOK_ID,
  browserBookId: G3_ENGLISH_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG3EnglishSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g3-eng-s1-nccd-u1). */
export const g3EnglishSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g3-eng-s1-nccd-u1_l1). */
export const g3EnglishSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG3EnglishSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG3EnglishSem1Catalog = catalog.buildCatalog;
export const buildG3EnglishSem1BrowserCatalog = catalog.buildBrowserCatalog;
