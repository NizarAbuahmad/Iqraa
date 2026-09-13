/**
 * Grade 8 Social Studies (الدراسات الاجتماعية) — Semester 2 (NCCD student
 * book). Same shape as Semester 1.
 */

import raw from '../data/iqra_curriculum_g8_social_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G8_SOCIAL_S2_BOOK_ID = 'kb-social-8-s2';
export const G8_SOCIAL_S2_CURRICULUM_BOOK_ID = 'book-social-8-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-8', subject: 'social', semester: 2 },
  kbBookId: G8_SOCIAL_S2_BOOK_ID,
  browserBookId: G8_SOCIAL_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG8SocialSem2: NccdCurriculumFile = catalog.curriculum;
export const g8SocialSem2UnitKbId = catalog.unitKbId;
export const g8SocialSem2LessonKbId = catalog.lessonKbId;
export const findG8SocialSem2LessonByKbId = catalog.findLessonByKbId;
export const buildG8SocialSem2Catalog = catalog.buildCatalog;
export const buildG8SocialSem2BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G8SocialSem2Lesson };
