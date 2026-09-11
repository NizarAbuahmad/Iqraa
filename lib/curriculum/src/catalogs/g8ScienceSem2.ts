/**
 * Grade 8 Science (العلوم) — Semester 2 (NCCD student book + teacher guide).
 * Source of truth: data/iqra_curriculum_g8_science_sem2.json
 *
 * Built through `makeNccdCatalog` — see `nccdCatalog.ts` — because this book
 * prints exactly the shape that factory assumes: «الفكرةُ الرئيسةُ»,
 * «نتاجاتُ التعلُّمِ» and a bilingual «المفاهيمُ والمصطلحاتُ» on every lesson
 * opener, plus a «الفكرةُ العامةُ» on every unit opener.
 *
 * Units are numbered 5-9, not 1-5: the book continues Semester 1's numbering
 * rather than restarting, so the JSON ids are `u5`…`u9` and `number` matches
 * what a teacher reads on the page.
 *
 * `periods` is populated for all eleven lessons from the guide's «عدد الحصص»
 * column. Two things the guide did not give cleanly, both recorded in the
 * JSON's `known_gaps`: unit 5's «نتاجات تعلم الصفوف السابقة» column is printed
 * empty, so its `prior_knowledge` is an empty list; and unit 5's lesson table
 * prints two rows labelled «الدرس 2», one of them a leftover from the
 * Semester 1 guide («التكاثر», 3 حصص) that names no lesson in this book.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g8_science_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G8_SCIENCE_S2_BOOK_ID = 'kb-science-8-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G8_SCIENCE_S2_CURRICULUM_BOOK_ID = 'book-science-8-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-8', subject: 'science', semester: 2 },
  kbBookId: G8_SCIENCE_S2_BOOK_ID,
  browserBookId: G8_SCIENCE_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG8ScienceSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u5 → kbu-g8-science-s2-nccd-u5). */
export const g8ScienceSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u5_l1 → kbl-g8-science-s2-nccd-u5_l1). */
export const g8ScienceSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG8ScienceSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG8ScienceSem2Catalog = catalog.buildCatalog;
export const buildG8ScienceSem2BrowserCatalog = catalog.buildBrowserCatalog;
