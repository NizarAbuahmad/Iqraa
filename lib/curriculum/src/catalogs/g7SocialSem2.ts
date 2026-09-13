/**
 * Grade 7 Social Studies (الدراسات الاجتماعية) — Semester 2 (NCCD student
 * book). Same shape as Semester 1 — objectives empty (no teacher guide,
 * and the book's own «ماذا سأتعلم؟» box lists sub-topics, not numbered
 * outcomes).
 */

import raw from '../data/iqra_curriculum_g7_social_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G7_SOCIAL_S2_BOOK_ID = 'kb-social-7-s2';
export const G7_SOCIAL_S2_CURRICULUM_BOOK_ID = 'book-social-7-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-7', subject: 'social', semester: 2 },
  kbBookId: G7_SOCIAL_S2_BOOK_ID,
  browserBookId: G7_SOCIAL_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG7SocialSem2: NccdCurriculumFile = catalog.curriculum;
export const g7SocialSem2UnitKbId = catalog.unitKbId;
export const g7SocialSem2LessonKbId = catalog.lessonKbId;
export const findG7SocialSem2LessonByKbId = catalog.findLessonByKbId;
export const buildG7SocialSem2Catalog = catalog.buildCatalog;
export const buildG7SocialSem2BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G7SocialSem2Lesson };
