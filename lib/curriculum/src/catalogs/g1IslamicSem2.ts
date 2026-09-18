/**
 * Grade 1 Islamic Education (التربية الإسلامية) — Semester 2 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g1_islamic_sem2.json
 *
 * Same book series and box layout as g1IslamicSem1.ts: no «الفِكْرَةُ
 * الرَّئيسَةُ» box (one lesson, «الحَديثُ الشَّريفُ: نِعْمَةُ الطَّعامِ»,
 * names the phrase inside its own «نَتاجاتُ التَّعَلُّمِ» list rather than as
 * a separate box). `main_idea_ar` is the unlabeled declarative sentence
 * printed directly under each lesson's title; `objectives` comes from the
 * end-of-lesson «نَتاجاتُ التَّعَلُّمِ» box inside «أُقَيِّمُ تَعَلُّمي».
 * `vocabulary` is empty throughout — same reason as Semester 1.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g1_islamic_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G1_ISLAMIC_S2_BOOK_ID = 'kb-islamic-1-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G1_ISLAMIC_S2_CURRICULUM_BOOK_ID = 'book-islamic-1-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-1', subject: 'islamic', semester: 2 },
  kbBookId: G1_ISLAMIC_S2_BOOK_ID,
  browserBookId: G1_ISLAMIC_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG1IslamicSem2: NccdCurriculumFile = catalog.curriculum;
export const g1IslamicSem2UnitKbId = catalog.unitKbId;
export const g1IslamicSem2LessonKbId = catalog.lessonKbId;
export const findG1IslamicSem2LessonByKbId = catalog.findLessonByKbId;
export const buildG1IslamicSem2Catalog = catalog.buildCatalog;
export const buildG1IslamicSem2BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G1IslamicSem2Lesson };
