/**
 * Grade 1 Islamic Education (التربية الإسلامية) — Semester 1 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g1_islamic_sem1.json
 *
 * Built through `makeNccdCatalog`, but this book does NOT print the shape
 * that factory assumes — unlike g3IslamicSem1/g4IslamicSem1/g5IslamicSem1,
 * it prints no «الفِكْرَةُ الرَّئيسَةُ» box at all (verified via a full-book
 * grep, 0 hits across all 88 pages). `main_idea_ar` is instead the unlabeled
 * declarative sentence printed directly under each lesson's title, and
 * `objectives` comes from a «نَتاجاتُ التَّعَلُّمِ» box at the END of each
 * lesson (inside «أُقَيِّمُ تَعَلُّمي»), not a start-of-lesson box like every
 * other grade's Islamic book. `vocabulary` is empty throughout: the only
 * term boxes are Arabic-only («إِضاءَةٌ» single-term, «الْمُفْرَداتُ
 * وَالتَّراكيبُ» Quran/hadith glossary) with no English pairing.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g1_islamic_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G1_ISLAMIC_S1_BOOK_ID = 'kb-islamic-1-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G1_ISLAMIC_S1_CURRICULUM_BOOK_ID = 'book-islamic-1-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-1', subject: 'islamic', semester: 1 },
  kbBookId: G1_ISLAMIC_S1_BOOK_ID,
  browserBookId: G1_ISLAMIC_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG1IslamicSem1: NccdCurriculumFile = catalog.curriculum;
export const g1IslamicSem1UnitKbId = catalog.unitKbId;
export const g1IslamicSem1LessonKbId = catalog.lessonKbId;
export const findG1IslamicSem1LessonByKbId = catalog.findLessonByKbId;
export const buildG1IslamicSem1Catalog = catalog.buildCatalog;
export const buildG1IslamicSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G1IslamicSem1Lesson };
