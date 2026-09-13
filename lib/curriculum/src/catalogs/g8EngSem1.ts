/**
 * Grade 8 English (اللغة الإنجليزية) — Semester 1 (Jordan High Note student book).
 * Source of truth: data/iqra_curriculum_g8_eng_sem1.json
 *
 * Built through `makeNccdCatalog` — see `nccdCatalog.ts`.
 *
 * Same Pearson "Jordan High Note" series and format as g9EngSem1.ts: five
 * units, each with exactly seven `LESSON nA` pages ending in one printed
 * `□ I can …` outcome. See that file's doc comment and this JSON's
 * `provenance_note`/`known_gaps` for why the seven-lesson breakdown is
 * trustworthy here and why periods/vocabulary stay empty.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g8_eng_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G8_ENG_S1_BOOK_ID = 'kb-eng-8-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G8_ENG_S1_CURRICULUM_BOOK_ID = 'book-eng-8-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-8', subject: 'eng', semester: 1 },
  kbBookId: G8_ENG_S1_BOOK_ID,
  browserBookId: G8_ENG_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG8EngSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g8-eng-s1-nccd-u1). */
export const g8EngSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g8-eng-s1-nccd-u1_l1). */
export const g8EngSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG8EngSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG8EngSem1Catalog = catalog.buildCatalog;
export const buildG8EngSem1BrowserCatalog = catalog.buildBrowserCatalog;
