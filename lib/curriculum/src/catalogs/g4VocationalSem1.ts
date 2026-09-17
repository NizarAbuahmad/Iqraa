/**
 * Grade 4 Vocational Education (التربية المهنية) — Semester 1 (NCCD
 * student book). Seven units, each its own vocational track (life skills,
 * entrepreneurship, agriculture, home economics, safety/health/environment,
 * woodworking, tourism).
 *
 * Real content: main_idea_ar from each lesson's own «الفِكْرَةُ الرَّئيسَةُ» box
 * and general_idea_ar from each unit's own «الفِكْرَةُ العامَّةُ» box — this
 * book's PDF extracts cleanly through PyMuPDF (unlike Semester 2, see
 * g4VocationalSem2.ts). objectives/vocabulary left empty — see the JSON's
 * known_gaps.
 *
 * This subject reached grade-4 only when `SUBJECTS.grades` was extended for
 * it (alongside creative-arts, see g4CreativeArts.ts) — it had been declared
 * for grade-6..grade-8 alone, which would have left the book catalogued and
 * permanently unreachable. See catalog.ts.
 */

import raw from '../data/iqra_curriculum_g4_vocational_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G4_VOC_S1_BOOK_ID = 'kb-voc-4-s1';
export const G4_VOC_S1_CURRICULUM_BOOK_ID = 'book-voc-4-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-4', subject: 'voc', semester: 1 },
  kbBookId: G4_VOC_S1_BOOK_ID,
  browserBookId: G4_VOC_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG4VocSem1: NccdCurriculumFile = catalog.curriculum;
export const g4VocSem1UnitKbId = catalog.unitKbId;
export const g4VocSem1LessonKbId = catalog.lessonKbId;
export const findG4VocSem1LessonByKbId = catalog.findLessonByKbId;
export const buildG4VocSem1Catalog = catalog.buildCatalog;
export const buildG4VocSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G4VocSem1Lesson };
