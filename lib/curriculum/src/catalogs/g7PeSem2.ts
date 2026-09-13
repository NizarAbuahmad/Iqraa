/**
 * Grade 7 Physical Education (التربية الرياضية) — Semester 2 (NCCD student
 * book). Track and field, handball, volleyball, and a knowledge-based
 * health-concepts unit (not a motor-skill unit — carries no vocabulary box
 * in either of its two lessons). Same shape as Semester 1.
 */

import raw from '../data/iqra_curriculum_g7_physical_education_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G7_PE_S2_BOOK_ID = 'kb-pe-7-s2';
export const G7_PE_S2_CURRICULUM_BOOK_ID = 'book-pe-7-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-7', subject: 'pe', semester: 2 },
  kbBookId: G7_PE_S2_BOOK_ID,
  browserBookId: G7_PE_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG7PeSem2: NccdCurriculumFile = catalog.curriculum;
export const g7PeSem2UnitKbId = catalog.unitKbId;
export const g7PeSem2LessonKbId = catalog.lessonKbId;
export const findG7PeSem2LessonByKbId = catalog.findLessonByKbId;
export const buildG7PeSem2Catalog = catalog.buildCatalog;
export const buildG7PeSem2BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G7PeSem2Lesson };
