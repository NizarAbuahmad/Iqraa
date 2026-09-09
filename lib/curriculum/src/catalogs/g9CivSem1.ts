/**
 * Grade 9 National and Civic Education (التربية الوطنية والمدنية) — Semester 1
 * (NCCD student book).
 *
 * New subjectId `civic-education`, internal tag stem `civ` (see
 * curriculumIds.ts). Same shape as Geography/History: a unit-level «الفكرة
 * العامة» populates general_idea_ar, a per-lesson «الفكرة الرئيسة» populates
 * main_idea_ar, and a bilingual «المصطلحات» box populates vocabulary. No
 * teacher guide exists, so objectives stay empty. Each lesson opener also
 * prints a «مهارات التعلم» skills box (e.g. cause-and-effect, classification)
 * that has no field in this schema and was not carried over.
 */

import raw from '../data/iqra_curriculum_g9_civic_education_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G9_CIV_S1_BOOK_ID = 'kb-civ-9-s1';
export const G9_CIV_S1_CURRICULUM_BOOK_ID = 'book-civ-9-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-9', subject: 'civ', semester: 1 },
  kbBookId: G9_CIV_S1_BOOK_ID,
  browserBookId: G9_CIV_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG9CivSem1: NccdCurriculumFile = catalog.curriculum;
export const g9CivSem1UnitKbId = catalog.unitKbId;
export const g9CivSem1LessonKbId = catalog.lessonKbId;
export const findG9CivSem1LessonByKbId = catalog.findLessonByKbId;
export const buildG9CivSem1Catalog = catalog.buildCatalog;
export const buildG9CivSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G9CivSem1Lesson };
