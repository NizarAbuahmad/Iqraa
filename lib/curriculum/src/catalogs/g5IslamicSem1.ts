/**
 * Grade 5 Islamic Education (التربية الإسلامية) — Semester 1 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g5_islamic_sem1.json
 *
 * Unlike g6IslamicSem1 (title-only, because pdf-parse dropped the assimilated
 * lam in that book's text), this book reads cleanly through PyMuPDF, so its
 * content is actually transcribed rather than deferred. Every lesson prints
 * a «الفِكْرَةُ الرَّئيسَةُ» box (three tilawah/tajweed-application lessons
 * excepted — the book gives them none), but no unit prints a general-idea or
 * prior-knowledge box, and no lesson prints a bilingual term-pairs box —
 * unlike this grade's HarperCollins-translated math/science books, this one
 * is NCCD's own Arabic-native Islamic-studies text and simply isn't shaped
 * that way. `objectives`, `prior_knowledge`, `general_idea_ar` and
 * `vocabulary` are therefore empty throughout; see the JSON's known_gaps.
 *
 * Only the eighteen numbered lessons are carried, matching the printed table
 * of contents exactly: 4 units, 4+5+4+5 lessons. The unit/lesson order was
 * verified against each unit's own opener page (each prints «دُروسُ
 * الوَحْدَةِ» directly), not read off the combined Fihris page, whose four
 * lesson-list blocks print in a different order than the units themselves.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g5_islamic_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G5_ISLAMIC_S1_BOOK_ID = 'kb-islamic-5-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G5_ISLAMIC_S1_CURRICULUM_BOOK_ID = 'book-islamic-5-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-5', subject: 'islamic', semester: 1 },
  kbBookId: G5_ISLAMIC_S1_BOOK_ID,
  browserBookId: G5_ISLAMIC_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG5IslamicSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g5-islamic-s1-nccd-u1). */
export const g5IslamicSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g5-islamic-s1-nccd-u1_l1). */
export const g5IslamicSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG5IslamicSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG5IslamicSem1Catalog = catalog.buildCatalog;
export const buildG5IslamicSem1BrowserCatalog = catalog.buildBrowserCatalog;
