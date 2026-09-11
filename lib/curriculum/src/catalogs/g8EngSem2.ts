/**
 * Grade 8 English (اللغة الإنجليزية) — Semester 2 (Jordan High Note student book).
 * Source of truth: data/iqra_curriculum_g8_eng_sem2.json
 *
 * Built through `makeNccdCatalog` — see `nccdCatalog.ts`.
 *
 * Same Pearson "Jordan High Note" series and format as g8EngSem1.ts and
 * g9EngSem2.ts: five units, each with exactly seven `LESSON nA` pages ending
 * in one printed `□ I can …` outcome. Units are numbered 6-10, continuing
 * from Semester 1's u1-u5 — mirroring g9EngSem2.ts, not restarting at u1.
 * See that file's doc comment and this JSON's provenance_note/known_gaps for
 * why the seven-lesson breakdown is trustworthy here and why
 * periods/vocabulary stay empty.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g8_eng_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G8_ENG_S2_BOOK_ID = 'kb-eng-8-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G8_ENG_S2_CURRICULUM_BOOK_ID = 'book-eng-8-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-8', subject: 'eng', semester: 2 },
  kbBookId: G8_ENG_S2_BOOK_ID,
  browserBookId: G8_ENG_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG8EngSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u6 → kbu-g8-eng-s2-nccd-u6). */
export const g8EngSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u6_l1 → kbl-g8-eng-s2-nccd-u6_l1). */
export const g8EngSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG8EngSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG8EngSem2Catalog = catalog.buildCatalog;
export const buildG8EngSem2BrowserCatalog = catalog.buildBrowserCatalog;
