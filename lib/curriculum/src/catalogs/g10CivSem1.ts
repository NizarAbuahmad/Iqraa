/**
 * Grade 10 National and Civic Education (التربية الوطنية والمدنية) — Semester 1
 * (NCCD student book).
 *
 * Extends the `civic-education` subject (introduced 2026-09-09 as a Grade
 * 9-only subject) to Grade 10. Same `civ` tag stem — grade-10 is
 * `curriculumIds.ts`'s implicit grade, so these units carry bare tags
 * (`civ-s1`) with no grade segment, distinct from Grade 9's `g9-civ-s1`.
 *
 * Same shape as the Grade 9 book: a unit-level «الفكرة العامة» populates
 * general_idea_ar, a per-lesson «الفكرة الرئيسة» populates main_idea_ar, and
 * a bilingual «المصطلحات» box populates vocabulary. No teacher guide exists,
 * so objectives stay empty. Each lesson opener also prints a «مهارات التعلم»
 * skills box that has no field in this schema and was not carried over.
 */

import raw from '../data/iqra_curriculum_g10_civic_education_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const CIV_S1_BOOK_ID = 'kb-civ-10-s1';
export const CIV_S1_CURRICULUM_BOOK_ID = 'book-civ-10-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-10', subject: 'civ', semester: 1 },
  kbBookId: CIV_S1_BOOK_ID,
  browserBookId: CIV_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdCivSem1: NccdCurriculumFile = catalog.curriculum;
export const civSem1UnitKbId = catalog.unitKbId;
export const civSem1LessonKbId = catalog.lessonKbId;
export const findCivSem1LessonByKbId = catalog.findLessonByKbId;
export const buildCivSem1Catalog = catalog.buildCatalog;
export const buildCivSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as CivSem1Lesson };
