/**
 * Grade 1 Physical Education (التربية الرياضية) — Semester 1 (NCCD student
 * book, 2025–2026 reprint). Source of truth:
 * data/iqra_curriculum_g1_physical_education_sem1.json
 *
 * Same shape as g1PhysicalEducationSem2.ts and g3PhysicalEducationSem1.ts:
 * every lesson's opener page prints a «الفِكْرَةُ الرَّئيسَةُ» box and a
 * bilingual «المَفاهيمُ وَالْمُصْطَلَحاتُ الأَساسِيَّةُ» glossary, so
 * main_idea_ar and vocabulary are both transcribed for all 14 lessons
 * (3 units: formations and basic positions, running games, balance games).
 * objectives are left empty — this book has no separate learning-outcomes
 * box; see the JSON's known_gaps.
 *
 * Completes Grade 1 PE: Semester 2 (units 4-6) was catalogued first, on
 * 2026-09-19, when no Semester 1 book was available. This book prints its
 * units 1-3, so the whole-year numbering is continuous.
 */

import raw from '../data/iqra_curriculum_g1_physical_education_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G1_PE_S1_BOOK_ID = 'kb-pe-1-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G1_PE_S1_CURRICULUM_BOOK_ID = 'book-pe-1-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-1', subject: 'pe', semester: 1 },
  kbBookId: G1_PE_S1_BOOK_ID,
  browserBookId: G1_PE_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG1PhysicalEducationSem1: NccdCurriculumFile = catalog.curriculum;
export const g1PhysicalEducationSem1UnitKbId = catalog.unitKbId;
export const g1PhysicalEducationSem1LessonKbId = catalog.lessonKbId;
export const findG1PhysicalEducationSem1LessonByKbId = catalog.findLessonByKbId;
export const buildG1PhysicalEducationSem1Catalog = catalog.buildCatalog;
export const buildG1PhysicalEducationSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G1PhysicalEducationSem1Lesson };
