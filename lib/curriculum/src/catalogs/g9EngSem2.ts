/**
 * Grade 9 English (اللغة الإنجليزية) — Semester 2 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g9_eng_sem2.json
 *
 * Mirrors g9EngSem1.ts — read that header for why this subject has seven
 * lessons per unit where Grade 10 English has one, and for why the Arabic
 * strings are translations while the `I can` outcomes stay in English.
 *
 * Units are numbered 6-10, continuing from S1. Note the unit page ranges are
 * NOT contiguous: `LIFE SKILLS` spreads sit between units (pages 14-15, 36-37
 * and 58-59 as printed), and they carry no `LESSON nA` header and no `I can`
 * statement, so they are excluded rather than absorbed into a neighbouring
 * unit. Treating the ranges as contiguous would have pulled those pages into
 * unit 7 and unit 9 and broken the seven-per-unit invariant — which is what
 * that invariant is for.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g9_eng_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G9_ENG_S2_BOOK_ID = 'kb-eng-9-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G9_ENG_S2_CURRICULUM_BOOK_ID = 'book-eng-9-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-9', subject: 'eng', semester: 2 },
  kbBookId: G9_ENG_S2_BOOK_ID,
  browserBookId: G9_ENG_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG9EngSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u6 → kbu-g9-eng-s2-nccd-u6). */
export const g9EngSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u6_l1 → kbl-g9-eng-s2-nccd-u6_l1). */
export const g9EngSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG9EngSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG9EngSem2Catalog = catalog.buildCatalog;
export const buildG9EngSem2BrowserCatalog = catalog.buildBrowserCatalog;
