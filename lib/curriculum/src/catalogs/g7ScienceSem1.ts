/**
 * Grade 7 Science (العلوم) — Semester 1 (NCCD student book + teacher guide).
 * Source of truth: data/iqra_curriculum_g7_science_sem1.json
 *
 * Built through `makeNccdCatalog` — see `nccdCatalog.ts` — because this book
 * prints exactly the shape that factory assumes: «الفكرةُ الرئيسةُ»,
 * «نتاجاتُ التعلُّمِ» and a bilingual «المفاهيمُ والمصطلحاتُ» on every lesson
 * opener, plus a «الفكرةُ العامةُ» on every unit opener (except Unit 3 — see
 * known_gaps).
 *
 * The teacher guide is a first "تجريبية" trial edition (2020) that predates
 * the attached student book's second, expanded/revised edition (2026) by six
 * years, so three of five units (1, 3, 5) have a structurally different
 * lesson set between the two books — periods/total_periods are left null for
 * every lesson/unit the guide has no title-matching counterpart for, rather
 * than guessed. See the JSON's `known_gaps` for the full accounting,
 * including an activity-book cross-check confirming a merged unit-3 lesson.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g7_science_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G7_SCIENCE_S1_BOOK_ID = 'kb-science-7-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G7_SCIENCE_S1_CURRICULUM_BOOK_ID = 'book-science-7-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-7', subject: 'science', semester: 1 },
  kbBookId: G7_SCIENCE_S1_BOOK_ID,
  browserBookId: G7_SCIENCE_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG7ScienceSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g7-science-s1-nccd-u1). */
export const g7ScienceSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g7-science-s1-nccd-u1_l1). */
export const g7ScienceSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG7ScienceSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG7ScienceSem1Catalog = catalog.buildCatalog;
export const buildG7ScienceSem1BrowserCatalog = catalog.buildBrowserCatalog;
