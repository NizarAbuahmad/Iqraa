/**
 * Grade 3 Social Studies (الدراسات الاجتماعية) — Semester 1 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g3_social_sem1.json
 *
 * Same shape as g4SocialSem1 — this is NCCD's own Arabic-native text, not a
 * HarperCollins translation. Every lesson prints a «الفِكْرَةُ الرَّئيسَةُ» box
 * and a «المَفاهيمُ وَالمُصْطَلَحاتُ» box with real English glosses printed
 * inline next to each Arabic term. Every unit also prints a «الفِكْرَةُ
 * العامَّةُ» box on its opener page.
 *
 * This book's own PDF uses reversed/presentation-form Arabic glyphs
 * throughout (a font-encoding quirk, not corrupted CMap — still fully
 * readable by hand, same category as g4VocationalSem2's char-scramble, not
 * g5SocialSem1's true CMap corruption). One lesson's main-idea box (u2_l1)
 * repeats a different lesson's text verbatim — verified as a printing defect
 * in the book itself via independent re-extraction — so main_idea_ar is left
 * empty there rather than guessed; see the JSON's known_gaps.
 *
 * Only the ten numbered lessons are carried, matching the printed table of
 * contents: 3 units, 4+3+3 lessons.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g3_social_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G3_SOCIAL_S1_BOOK_ID = 'kb-social-3-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G3_SOCIAL_S1_CURRICULUM_BOOK_ID = 'book-social-3-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-3', subject: 'social', semester: 1 },
  kbBookId: G3_SOCIAL_S1_BOOK_ID,
  browserBookId: G3_SOCIAL_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG3SocialSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g3-social-s1-nccd-u1). */
export const g3SocialSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g3-social-s1-nccd-u1_l1). */
export const g3SocialSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG3SocialSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG3SocialSem1Catalog = catalog.buildCatalog;
export const buildG3SocialSem1BrowserCatalog = catalog.buildBrowserCatalog;
