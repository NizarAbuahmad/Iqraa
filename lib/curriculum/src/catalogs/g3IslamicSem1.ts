/**
 * Grade 3 Islamic Education (التربية الإسلامية) — Semester 1 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g3_islamic_sem1.json
 *
 * Same shape as g4IslamicSem1/g5IslamicSem1 — this book reads cleanly through
 * PyMuPDF. Every one of the twelve lessons prints a «الفِكْرَةُ الرَّئيسَةُ» box
 * (unlike g4IslamicSem1, which excludes seven tilawah/recitation lessons), but
 * no unit prints a general-idea or prior-knowledge box, and no lesson prints a
 * bilingual term-pairs box — this is NCCD's own Arabic-native Islamic-studies
 * text, not one of this grade's HarperCollins-translated math/science books.
 * `objectives`, `prior_knowledge`, `general_idea_ar` and `vocabulary` are
 * therefore empty throughout; see the JSON's known_gaps.
 *
 * Only the twelve numbered lessons are carried, matching the printed table of
 * contents exactly: 4 units, 3+3+3+3 lessons.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g3_islamic_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G3_ISLAMIC_S1_BOOK_ID = 'kb-islamic-3-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G3_ISLAMIC_S1_CURRICULUM_BOOK_ID = 'book-islamic-3-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-3', subject: 'islamic', semester: 1 },
  kbBookId: G3_ISLAMIC_S1_BOOK_ID,
  browserBookId: G3_ISLAMIC_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG3IslamicSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g3-islamic-s1-nccd-u1). */
export const g3IslamicSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g3-islamic-s1-nccd-u1_l1). */
export const g3IslamicSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG3IslamicSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG3IslamicSem1Catalog = catalog.buildCatalog;
export const buildG3IslamicSem1BrowserCatalog = catalog.buildBrowserCatalog;
