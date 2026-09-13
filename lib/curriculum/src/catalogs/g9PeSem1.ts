/**
 * Grade 9 Physical Education (التربية الرياضية) — Semester 1 (NCCD student
 * book).
 *
 * New subjectId `physical-education`, internal tag stem `pe` (not `phys`,
 * which is already Physics — see curriculumIds.ts). This is the first
 * skills-based (not knowledge-based) subject in the repo: football,
 * basketball, badminton, rhythmic movement, first aid. Each lesson opener
 * still carries the familiar «الفكرة الرئيسة» / «المفاهيم والمصطلحات» box
 * pair, so title/main-idea/vocabulary come from the same pipeline as every
 * other new subject this week — but the bulk of each lesson is a
 * step-by-step technique instruction box («النواحي الفنّية») that has no
 * field in this schema and was not carried over (see the data files'
 * known_gaps). No teacher guide exists, so objectives stay empty.
 */

import raw from '../data/iqra_curriculum_g9_physical_education_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G9_PE_S1_BOOK_ID = 'kb-pe-9-s1';
export const G9_PE_S1_CURRICULUM_BOOK_ID = 'book-pe-9-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-9', subject: 'pe', semester: 1 },
  kbBookId: G9_PE_S1_BOOK_ID,
  browserBookId: G9_PE_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG9PeSem1: NccdCurriculumFile = catalog.curriculum;
export const g9PeSem1UnitKbId = catalog.unitKbId;
export const g9PeSem1LessonKbId = catalog.lessonKbId;
export const findG9PeSem1LessonByKbId = catalog.findLessonByKbId;
export const buildG9PeSem1Catalog = catalog.buildCatalog;
export const buildG9PeSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G9PeSem1Lesson };
