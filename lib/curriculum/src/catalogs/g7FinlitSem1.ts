/**
 * Grade 7 Financial Literacy (الثقافة المالية) — Semester 1 (NCCD student
 * book, no teacher guide). Same shape as the Grade 8/9 precedent: real
 * numbered «نتاجات التعلم» per lesson from the book itself, bilingual
 * vocabulary cross-checked against the book's own end-of-book glossary
 * rather than the shorter per-lesson concept box (the two occasionally
 * disagree in wording — see the JSON's known_gaps).
 */

import raw from '../data/iqra_curriculum_g7_financial_literacy_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G7_FINLIT_S1_BOOK_ID = 'kb-finlit-7-s1';
export const G7_FINLIT_S1_CURRICULUM_BOOK_ID = 'book-finlit-7-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-7', subject: 'finlit', semester: 1 },
  kbBookId: G7_FINLIT_S1_BOOK_ID,
  browserBookId: G7_FINLIT_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG7FinlitSem1: NccdCurriculumFile = catalog.curriculum;
export const g7FinlitSem1UnitKbId = catalog.unitKbId;
export const g7FinlitSem1LessonKbId = catalog.lessonKbId;
export const findG7FinlitSem1LessonByKbId = catalog.findLessonByKbId;
export const buildG7FinlitSem1Catalog = catalog.buildCatalog;
export const buildG7FinlitSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G7FinlitSem1Lesson };
