/**
 * Grade 2 Islamic Education (التربية الإسلامية) — Semester 1 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g2_islamic_sem1.json
 *
 * Built through `makeNccdCatalog` — this book prints the exact shape that
 * factory assumes on every lesson opener («الفِكْرَةُ الرَّئيسَةُ», no
 * bilingual terms box), same as g3IslamicSem1/g4IslamicSem1/g5IslamicSem1.
 * Unlike g1IslamicSem1.ts, this book DOES print «الفِكْرَةُ الرَّئيسَةُ» on
 * every one of its twelve lessons.
 *
 * `objectives` and `vocabulary` are empty throughout: the student book
 * prints no «نتاجاتُ التعلُّمِ» box and no bilingual terms box.
 * `general_idea_ar`/`prior_knowledge` stay empty for every unit — the
 * opener page lists only «دُروسُ الوَحْدَةِ», no «الفِكْرَةُ العامَّةُ» box.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g2_islamic_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G2_ISLAMIC_S1_BOOK_ID = 'kb-islamic-2-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G2_ISLAMIC_S1_CURRICULUM_BOOK_ID = 'book-islamic-2-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-2', subject: 'islamic', semester: 1 },
  kbBookId: G2_ISLAMIC_S1_BOOK_ID,
  browserBookId: G2_ISLAMIC_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG2IslamicSem1: NccdCurriculumFile = catalog.curriculum;
export const g2IslamicSem1UnitKbId = catalog.unitKbId;
export const g2IslamicSem1LessonKbId = catalog.lessonKbId;
export const findG2IslamicSem1LessonByKbId = catalog.findLessonByKbId;
export const buildG2IslamicSem1Catalog = catalog.buildCatalog;
export const buildG2IslamicSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G2IslamicSem1Lesson };
