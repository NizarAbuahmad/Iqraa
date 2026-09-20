/**
 * Grade 2 Social Studies (الدراسات الاجتماعية) — Semester 1 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g2_social_sem1.json
 *
 * Built through `makeNccdCatalog` — this book prints the exact shape that
 * factory assumes on every lesson opener («الفِكْرَةُ الرَّئيسَةُ» and a
 * bilingual «المَفاهيمُ وَالمُصْطَلَحاتُ») and on every unit opener
 * («الفِكْرَةُ العامَّةُ»), same as g3SocialSem1/g4SocialSem1.
 *
 * `objectives` and `prior_knowledge` are empty throughout: the student book
 * prints no «نتاجاتُ التعلُّمِ» box and no «تعلَّمْتُ سابقًا» box.
 *
 * 3 units, 3+4+4 lessons. The book's own table of contents is jumbled in
 * layout but its unit/lesson-to-page mapping checked out against a direct
 * content-page spot check, unlike g2ArabicSem2's genuinely unreliable TOC.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g2_social_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G2_SOCIAL_S1_BOOK_ID = 'kb-social-2-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G2_SOCIAL_S1_CURRICULUM_BOOK_ID = 'book-social-2-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-2', subject: 'social', semester: 1 },
  kbBookId: G2_SOCIAL_S1_BOOK_ID,
  browserBookId: G2_SOCIAL_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG2SocialSem1: NccdCurriculumFile = catalog.curriculum;
export const g2SocialSem1UnitKbId = catalog.unitKbId;
export const g2SocialSem1LessonKbId = catalog.lessonKbId;
export const findG2SocialSem1LessonByKbId = catalog.findLessonByKbId;
export const buildG2SocialSem1Catalog = catalog.buildCatalog;
export const buildG2SocialSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G2SocialSem1Lesson };
