/**
 * Grade 10 History (التاريخ) — Semester 2 (NCCD student book). Same
 * shape as Semester 1.
 */

import raw from '../data/iqra_curriculum_g10_history_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const HIST_S2_BOOK_ID = 'kb-hist-10-s2';
export const HIST_S2_CURRICULUM_BOOK_ID = 'book-hist-10-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-10', subject: 'hist', semester: 2 },
  kbBookId: HIST_S2_BOOK_ID,
  browserBookId: HIST_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdHistSem2: NccdCurriculumFile = catalog.curriculum;
export const histSem2UnitKbId = catalog.unitKbId;
export const histSem2LessonKbId = catalog.lessonKbId;
export const findHistSem2LessonByKbId = catalog.findLessonByKbId;
export const buildHistSem2Catalog = catalog.buildCatalog;
export const buildHistSem2BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as HistSem2Lesson };
