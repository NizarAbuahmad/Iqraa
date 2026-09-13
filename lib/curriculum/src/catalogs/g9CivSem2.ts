/**
 * Grade 9 National and Civic Education (التربية الوطنية والمدنية) — Semester 2
 * (NCCD student book). Same shape as Semester 1.
 */

import raw from '../data/iqra_curriculum_g9_civic_education_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G9_CIV_S2_BOOK_ID = 'kb-civ-9-s2';
export const G9_CIV_S2_CURRICULUM_BOOK_ID = 'book-civ-9-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-9', subject: 'civ', semester: 2 },
  kbBookId: G9_CIV_S2_BOOK_ID,
  browserBookId: G9_CIV_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG9CivSem2: NccdCurriculumFile = catalog.curriculum;
export const g9CivSem2UnitKbId = catalog.unitKbId;
export const g9CivSem2LessonKbId = catalog.lessonKbId;
export const findG9CivSem2LessonByKbId = catalog.findLessonByKbId;
export const buildG9CivSem2Catalog = catalog.buildCatalog;
export const buildG9CivSem2BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G9CivSem2Lesson };
