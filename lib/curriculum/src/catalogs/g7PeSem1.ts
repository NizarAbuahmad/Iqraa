/**
 * Grade 7 Physical Education (التربية الرياضية) — Semester 1 (NCCD student
 * book). Same skills-based shape as the Grade 9 precedent (there is no
 * Grade 8 PE): football, basketball, badminton, rhythmic movement, general
 * safety. Title/main-idea/vocabulary come from each lesson's «الفكرة
 * الرئيسة» / «المفاهيم والمصطلحات» boxes where printed; the bulk of each
 * lesson (step-by-step technique instructions, official rules, enrichment,
 * self-assessment rubric) has no field in this schema and was not carried
 * over — see the JSON's known_gaps. No teacher guide exists, so objectives
 * and periods stay empty/null.
 */

import raw from '../data/iqra_curriculum_g7_physical_education_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G7_PE_S1_BOOK_ID = 'kb-pe-7-s1';
export const G7_PE_S1_CURRICULUM_BOOK_ID = 'book-pe-7-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-7', subject: 'pe', semester: 1 },
  kbBookId: G7_PE_S1_BOOK_ID,
  browserBookId: G7_PE_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG7PeSem1: NccdCurriculumFile = catalog.curriculum;
export const g7PeSem1UnitKbId = catalog.unitKbId;
export const g7PeSem1LessonKbId = catalog.lessonKbId;
export const findG7PeSem1LessonByKbId = catalog.findLessonByKbId;
export const buildG7PeSem1Catalog = catalog.buildCatalog;
export const buildG7PeSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G7PeSem1Lesson };
