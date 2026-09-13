/**
 * Grade 9 Financial Literacy (الثقافة المالية) — Semester 2 (NCCD student book).
 * Same shape as Semester 1: objectives and vocabulary come from the book's
 * own printed boxes; main_idea_ar is empty because this book has no «الفكرة
 * الرئيسة» box on any lesson.
 */

import raw from '../data/iqra_curriculum_g9_financial_literacy_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G9_FINLIT_S2_BOOK_ID = 'kb-finlit-9-s2';
export const G9_FINLIT_S2_CURRICULUM_BOOK_ID = 'book-finlit-9-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-9', subject: 'finlit', semester: 2 },
  kbBookId: G9_FINLIT_S2_BOOK_ID,
  browserBookId: G9_FINLIT_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG9FinlitSem2: NccdCurriculumFile = catalog.curriculum;
export const g9FinlitSem2UnitKbId = catalog.unitKbId;
export const g9FinlitSem2LessonKbId = catalog.lessonKbId;
export const findG9FinlitSem2LessonByKbId = catalog.findLessonByKbId;
export const buildG9FinlitSem2Catalog = catalog.buildCatalog;
export const buildG9FinlitSem2BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G9FinlitSem2Lesson };
