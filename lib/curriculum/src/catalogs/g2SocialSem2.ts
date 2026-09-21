/**
 * Grade 2 Social Studies (الدراسات الاجتماعية) — Semester 2 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g2_social_sem2.json
 *
 * Same shape as g2SocialSem1 — «الفِكْرَةُ الرَّئيسَةُ» and a bilingual
 * «المَفاهيمُ وَالمُصْطَلَحاتُ» on every lesson opener, «الفِكْرَةُ العامَّةُ»
 * on every unit opener. `objectives`/`prior_knowledge` stay empty (no
 * outcomes box, no prior-knowledge box printed).
 *
 * 3 units (4-6, continuing Semester 1's own numbering), 5+5+3 lessons.
 * Table-of-contents order was spot-checked against unit 4's own lesson 5
 * page directly and held up — same as Semester 1.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g2_social_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G2_SOCIAL_S2_BOOK_ID = 'kb-social-2-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G2_SOCIAL_S2_CURRICULUM_BOOK_ID = 'book-social-2-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-2', subject: 'social', semester: 2 },
  kbBookId: G2_SOCIAL_S2_BOOK_ID,
  browserBookId: G2_SOCIAL_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG2SocialSem2: NccdCurriculumFile = catalog.curriculum;
export const g2SocialSem2UnitKbId = catalog.unitKbId;
export const g2SocialSem2LessonKbId = catalog.lessonKbId;
export const findG2SocialSem2LessonByKbId = catalog.findLessonByKbId;
export const buildG2SocialSem2Catalog = catalog.buildCatalog;
export const buildG2SocialSem2BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G2SocialSem2Lesson };
