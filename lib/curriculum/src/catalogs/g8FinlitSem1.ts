/**
 * Grade 8 Financial Literacy (الثقافة المالية) — Semester 1 (NCCD student
 * book, first-ever grade-8 catalog module).
 *
 * `financial-literacy` already existed for grades 9-10; this only extends its
 * `grades` list. Semester 2 has not been attached yet — see known_gaps in the
 * data file.
 *
 * Unlike every other subject built through this factory so far, this book
 * prints real numbered «نتاجات التعلم» per lesson instead of no objectives at
 * all — no teacher guide was needed to get them. It has no «الفكرة الرئيسة»
 * paragraph though, so main_idea_ar is empty for every lesson and summaryAr/
 * summaryEn fall back to the factory's generated sentence.
 */

import raw from '../data/iqra_curriculum_g8_financial_literacy_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G8_FINLIT_S1_BOOK_ID = 'kb-finlit-8-s1';
export const G8_FINLIT_S1_CURRICULUM_BOOK_ID = 'book-finlit-8-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-8', subject: 'finlit', semester: 1 },
  kbBookId: G8_FINLIT_S1_BOOK_ID,
  browserBookId: G8_FINLIT_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG8FinlitSem1: NccdCurriculumFile = catalog.curriculum;
export const g8FinlitSem1UnitKbId = catalog.unitKbId;
export const g8FinlitSem1LessonKbId = catalog.lessonKbId;
export const findG8FinlitSem1LessonByKbId = catalog.findLessonByKbId;
export const buildG8FinlitSem1Catalog = catalog.buildCatalog;
export const buildG8FinlitSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G8FinlitSem1Lesson };
