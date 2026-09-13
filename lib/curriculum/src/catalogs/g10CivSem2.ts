/**
 * Grade 10 National and Civic Education (التربية الوطنية والمدنية) — Semester 2
 * (NCCD student book). Same shape as Semester 1; its five units continue the
 * first semester's numbering (u3…u7) rather than restarting at u1.
 */

import raw from '../data/iqra_curriculum_g10_civic_education_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const CIV_S2_BOOK_ID = 'kb-civ-10-s2';
export const CIV_S2_CURRICULUM_BOOK_ID = 'book-civ-10-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-10', subject: 'civ', semester: 2 },
  kbBookId: CIV_S2_BOOK_ID,
  browserBookId: CIV_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdCivSem2: NccdCurriculumFile = catalog.curriculum;
export const civSem2UnitKbId = catalog.unitKbId;
export const civSem2LessonKbId = catalog.lessonKbId;
export const findCivSem2LessonByKbId = catalog.findLessonByKbId;
export const buildCivSem2Catalog = catalog.buildCatalog;
export const buildCivSem2BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as CivSem2Lesson };
