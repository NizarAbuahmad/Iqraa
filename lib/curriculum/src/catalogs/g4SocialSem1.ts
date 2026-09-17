/**
 * Grade 4 Social Studies (الدراسات الاجتماعية) — Semester 1 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g4_social_sem1.json
 *
 * Unlike g5SocialSem1 (title-only, because a corrupted ToUnicode CMap made
 * even PyMuPDF decode garbled Arabic in that one book), this book reads
 * cleanly through PyMuPDF, so its content is actually transcribed rather
 * than deferred. Every lesson prints a «الفِكْرَةُ الرَّئيسَةُ» box and a
 * «المُصْطَلَحاتُ» box with real English glosses printed inline next to each
 * Arabic term — the same convention as this grade's science books, though
 * this is NCCD's own Arabic-native text, not a HarperCollins translation.
 * Every unit also prints a «الفِكْرَةُ العامَّةُ» box on its opener page.
 *
 * Only the fifteen numbered lessons are carried, matching the printed table
 * of contents exactly: 4 units, 4+3+3+5 lessons.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g4_social_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G4_SOCIAL_S1_BOOK_ID = 'kb-social-4-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G4_SOCIAL_S1_CURRICULUM_BOOK_ID = 'book-social-4-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-4', subject: 'social', semester: 1 },
  kbBookId: G4_SOCIAL_S1_BOOK_ID,
  browserBookId: G4_SOCIAL_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG4SocialSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g4-social-s1-nccd-u1). */
export const g4SocialSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g4-social-s1-nccd-u1_l1). */
export const g4SocialSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG4SocialSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG4SocialSem1Catalog = catalog.buildCatalog;
export const buildG4SocialSem1BrowserCatalog = catalog.buildBrowserCatalog;
