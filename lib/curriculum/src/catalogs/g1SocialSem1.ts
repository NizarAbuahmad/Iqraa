/**
 * Grade 1 Social Studies (الدراسات الاجتماعية) — Semester 1 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g1_social_sem1.json
 *
 * Same NCCD box conventions as g3SocialSem1.ts/g4SocialSem1.ts: «الفِكْرَةُ
 * الرَّئيسَةُ» + bilingual «المَفاهيمُ وَالمُصْطَلَحاتُ» per lesson, «الفِكْرَةُ
 * العامَّةُ» per unit. `objectives`/`prior_knowledge` empty (no outcomes or
 * prior-knowledge boxes printed). 3 units/12 lessons (6+3+3).
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g1_social_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G1_SOCIAL_S1_BOOK_ID = 'kb-social-1-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G1_SOCIAL_S1_CURRICULUM_BOOK_ID = 'book-social-1-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-1', subject: 'social', semester: 1 },
  kbBookId: G1_SOCIAL_S1_BOOK_ID,
  browserBookId: G1_SOCIAL_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG1SocialSem1: NccdCurriculumFile = catalog.curriculum;
export const g1SocialSem1UnitKbId = catalog.unitKbId;
export const g1SocialSem1LessonKbId = catalog.lessonKbId;
export const findG1SocialSem1LessonByKbId = catalog.findLessonByKbId;
export const buildG1SocialSem1Catalog = catalog.buildCatalog;
export const buildG1SocialSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G1SocialSem1Lesson };
