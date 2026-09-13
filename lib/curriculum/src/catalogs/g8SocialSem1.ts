/**
 * Grade 8 Social Studies (الدراسات الاجتماعية) — Semester 1 (NCCD student
 * book). This is the first real book behind the pre-existing 'social'
 * app subjectId (declared spanning grades 1-9, but bookless until now).
 *
 * Combines civics/human-rights, physical geography, ancient Mesopotamian
 * history, demography, media studies and philosophy into one book — NCCD's
 * own shape for this grade, not a split subject the way Grade 9/10 handle
 * geography/history/civics separately.
 *
 * Each lesson opener prints «الفكرة الرئيسة» and «المفاهيم والمصطلحات»,
 * but its «ماذا سأتعلم؟» box lists sub-topic headings rather than numbered
 * first-person objectives (unlike Grade 8 Financial Literacy/Vocational
 * Education) — so objectives stays empty here rather than forcing a
 * rewording the book never printed.
 */

import raw from '../data/iqra_curriculum_g8_social_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G8_SOCIAL_S1_BOOK_ID = 'kb-social-8-s1';
export const G8_SOCIAL_S1_CURRICULUM_BOOK_ID = 'book-social-8-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-8', subject: 'social', semester: 1 },
  kbBookId: G8_SOCIAL_S1_BOOK_ID,
  browserBookId: G8_SOCIAL_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG8SocialSem1: NccdCurriculumFile = catalog.curriculum;
export const g8SocialSem1UnitKbId = catalog.unitKbId;
export const g8SocialSem1LessonKbId = catalog.lessonKbId;
export const findG8SocialSem1LessonByKbId = catalog.findLessonByKbId;
export const buildG8SocialSem1Catalog = catalog.buildCatalog;
export const buildG8SocialSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G8SocialSem1Lesson };
