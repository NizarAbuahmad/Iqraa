/**
 * Grade 9 Financial Literacy (الثقافة المالية) — Semester 1 (NCCD student book).
 *
 * Unlike Islamic Education, this book prints نتاجات التعلّم and a bilingual
 * «المفاهيم والمصطلحات الرئيسة» box on nearly every lesson opener, so
 * `objectives` and `vocabulary` are populated from the book itself rather
 * than left empty. It has no «الفكرة الرئيسة» box though — each lesson opens
 * with an «أستكشف» scenario or question instead of a summary paragraph — so
 * `main_idea_ar` is empty throughout.
 *
 * `pdf-parse` extraction was refused for this book in an earlier pass
 * (whole-run reversal); every title, outcome, and term here was instead read
 * directly from the PDF's own pages (5.9MB, well under the Read tool's
 * 100MB cap), not from that extraction or from the later OCR pass.
 */

import raw from '../data/iqra_curriculum_g9_financial_literacy_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G9_FINLIT_S1_BOOK_ID = 'kb-finlit-9-s1';
export const G9_FINLIT_S1_CURRICULUM_BOOK_ID = 'book-finlit-9-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-9', subject: 'finlit', semester: 1 },
  kbBookId: G9_FINLIT_S1_BOOK_ID,
  browserBookId: G9_FINLIT_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG9FinlitSem1: NccdCurriculumFile = catalog.curriculum;
export const g9FinlitSem1UnitKbId = catalog.unitKbId;
export const g9FinlitSem1LessonKbId = catalog.lessonKbId;
export const findG9FinlitSem1LessonByKbId = catalog.findLessonByKbId;
export const buildG9FinlitSem1Catalog = catalog.buildCatalog;
export const buildG9FinlitSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G9FinlitSem1Lesson };
