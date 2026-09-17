/**
 * Grade 4 Social Studies (الدراسات الاجتماعية) — Semester 2 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g4_social_sem2.json
 *
 * Same shape as g4SocialSem1 — see that file for the factory rationale and
 * what this book does and does not print. Units are numbered 5-8, continuing
 * Semester 1's 1-4 — this is printed text in the book itself (each unit
 * opener explicitly prints "الوَحْدَةُ 5" through "الوَحْدَةُ 8"), unlike
 * g4IslamicSem2 where the same continuous numbering is only this project's
 * convention.
 *
 * The combined table-of-contents page (ص 3-4) prints "الوَحْدَةُ السّابِعَةُ"
 * and "الوَحْدَةُ الثّامِنَةُ" in a visual order that suggests Unit 7 is
 * "الخَرائِطُ الجُغْرافِيَّةُ" — but each unit's own opener page states the
 * opposite: Unit 7 is "العالَمُ مِنْ حَوْلي" (confirmed on its own opener,
 * ص 50) and Unit 8 is "الخَرائِطُ الجُغْرافِيَّةُ" (ص 68). Verified against
 * each unit's own opener page, not the combined contents page alone.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g4_social_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G4_SOCIAL_S2_BOOK_ID = 'kb-social-4-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G4_SOCIAL_S2_CURRICULUM_BOOK_ID = 'book-social-4-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-4', subject: 'social', semester: 2 },
  kbBookId: G4_SOCIAL_S2_BOOK_ID,
  browserBookId: G4_SOCIAL_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG4SocialSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u5 → kbu-g4-social-s2-nccd-u5). */
export const g4SocialSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u5_l1 → kbl-g4-social-s2-nccd-u5_l1). */
export const g4SocialSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG4SocialSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG4SocialSem2Catalog = catalog.buildCatalog;
export const buildG4SocialSem2BrowserCatalog = catalog.buildBrowserCatalog;
