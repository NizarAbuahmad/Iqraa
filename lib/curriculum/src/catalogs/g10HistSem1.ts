/**
 * Grade 10 History (التاريخ) — Semester 1 (NCCD student book).
 *
 * Extends the `history` subject (introduced 2026-09-09 as a Grade 9-only
 * subject) to Grade 10. Same `hist` tag stem — grade-10 is
 * `curriculumIds.ts`'s implicit grade, so these units carry bare tags
 * (`hist-s1`) with no grade segment, distinct from Grade 9's `g9-hist-s1`.
 *
 * Same shape as the Grade 9 book: a unit-level «الفكرة العامة» populates
 * general_idea_ar, a per-lesson «الفكرة الرئيسة» populates main_idea_ar, and
 * a bilingual «المفاهيم والمصطلحات» box populates vocabulary. No teacher
 * guide exists, so objectives stay empty.
 */

import raw from '../data/iqra_curriculum_g10_history_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const HIST_S1_BOOK_ID = 'kb-hist-10-s1';
export const HIST_S1_CURRICULUM_BOOK_ID = 'book-hist-10-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-10', subject: 'hist', semester: 1 },
  kbBookId: HIST_S1_BOOK_ID,
  browserBookId: HIST_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdHistSem1: NccdCurriculumFile = catalog.curriculum;
export const histSem1UnitKbId = catalog.unitKbId;
export const histSem1LessonKbId = catalog.lessonKbId;
export const findHistSem1LessonByKbId = catalog.findLessonByKbId;
export const buildHistSem1Catalog = catalog.buildCatalog;
export const buildHistSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as HistSem1Lesson };
