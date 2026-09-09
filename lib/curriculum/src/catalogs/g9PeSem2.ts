/**
 * Grade 9 Physical Education (التربية الرياضية) — Semester 2 (NCCD student
 * book). Same shape as Semester 1: track and field, handball, volleyball,
 * then a genuinely knowledge-based closing unit (health concepts and
 * habits) that carries no terms box at all — presented as infographics
 * instead.
 */

import raw from '../data/iqra_curriculum_g9_physical_education_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G9_PE_S2_BOOK_ID = 'kb-pe-9-s2';
export const G9_PE_S2_CURRICULUM_BOOK_ID = 'book-pe-9-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-9', subject: 'pe', semester: 2 },
  kbBookId: G9_PE_S2_BOOK_ID,
  browserBookId: G9_PE_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG9PeSem2: NccdCurriculumFile = catalog.curriculum;
export const g9PeSem2UnitKbId = catalog.unitKbId;
export const g9PeSem2LessonKbId = catalog.lessonKbId;
export const findG9PeSem2LessonByKbId = catalog.findLessonByKbId;
export const buildG9PeSem2Catalog = catalog.buildCatalog;
export const buildG9PeSem2BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G9PeSem2Lesson };
