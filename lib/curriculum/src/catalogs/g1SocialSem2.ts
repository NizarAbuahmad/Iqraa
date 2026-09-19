/**
 * Grade 1 Social Studies (الدراسات الاجتماعية) — Semester 2 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g1_social_sem2.json
 *
 * Same NCCD box conventions as g1SocialSem1.ts. Continues unit numbering
 * 4-6. 3 units/11 lessons (4+3+4). Source file is misnamed on disk (says
 * "الصف الرابع" / Grade 4) — verified against the PDF's own bibliographic
 * page as genuine Grade 1 Semester 2 content; see the JSON's provenance_note.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g1_social_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G1_SOCIAL_S2_BOOK_ID = 'kb-social-1-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G1_SOCIAL_S2_CURRICULUM_BOOK_ID = 'book-social-1-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-1', subject: 'social', semester: 2 },
  kbBookId: G1_SOCIAL_S2_BOOK_ID,
  browserBookId: G1_SOCIAL_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG1SocialSem2: NccdCurriculumFile = catalog.curriculum;
export const g1SocialSem2UnitKbId = catalog.unitKbId;
export const g1SocialSem2LessonKbId = catalog.lessonKbId;
export const findG1SocialSem2LessonByKbId = catalog.findLessonByKbId;
export const buildG1SocialSem2Catalog = catalog.buildCatalog;
export const buildG1SocialSem2BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G1SocialSem2Lesson };
