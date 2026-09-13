/**
 * Grade 7 Financial Literacy (الثقافة المالية) — Semester 2 (NCCD student
 * book, no teacher guide). Units numbered 4-6, continuing Semester 1's 1-3.
 * Same shape as Semester 1.
 */

import raw from '../data/iqra_curriculum_g7_financial_literacy_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G7_FINLIT_S2_BOOK_ID = 'kb-finlit-7-s2';
export const G7_FINLIT_S2_CURRICULUM_BOOK_ID = 'book-finlit-7-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-7', subject: 'finlit', semester: 2 },
  kbBookId: G7_FINLIT_S2_BOOK_ID,
  browserBookId: G7_FINLIT_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG7FinlitSem2: NccdCurriculumFile = catalog.curriculum;
export const g7FinlitSem2UnitKbId = catalog.unitKbId;
export const g7FinlitSem2LessonKbId = catalog.lessonKbId;
export const findG7FinlitSem2LessonByKbId = catalog.findLessonByKbId;
export const buildG7FinlitSem2Catalog = catalog.buildCatalog;
export const buildG7FinlitSem2BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G7FinlitSem2Lesson };
