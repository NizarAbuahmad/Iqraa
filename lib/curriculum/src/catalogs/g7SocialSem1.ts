/**
 * Grade 7 Social Studies (الدراسات الاجتماعية) — Semester 1 (NCCD student
 * book). Grade 7/8 both teach combined «الدراسات الاجتماعية» before it
 * splits into geography/history/civic-education from Grade 9.
 *
 * Same as the Grade 8 precedent: each lesson opener prints «الفكرة الرئيسة»
 * and «المفاهيم والمصطلحات», but its «ماذا سأتعلم؟» box lists sub-topic
 * headings rather than numbered first-person objectives — so objectives
 * stays empty here rather than forcing a rewording the book never printed.
 * No teacher guide exists for this subject at any grade.
 */

import raw from '../data/iqra_curriculum_g7_social_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G7_SOCIAL_S1_BOOK_ID = 'kb-social-7-s1';
export const G7_SOCIAL_S1_CURRICULUM_BOOK_ID = 'book-social-7-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-7', subject: 'social', semester: 1 },
  kbBookId: G7_SOCIAL_S1_BOOK_ID,
  browserBookId: G7_SOCIAL_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG7SocialSem1: NccdCurriculumFile = catalog.curriculum;
export const g7SocialSem1UnitKbId = catalog.unitKbId;
export const g7SocialSem1LessonKbId = catalog.lessonKbId;
export const findG7SocialSem1LessonByKbId = catalog.findLessonByKbId;
export const buildG7SocialSem1Catalog = catalog.buildCatalog;
export const buildG7SocialSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G7SocialSem1Lesson };
