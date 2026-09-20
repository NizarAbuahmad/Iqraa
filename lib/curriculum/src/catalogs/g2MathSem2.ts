/**
 * Grade 2 Math (الرياضيات) — Semester 2 (HarperCollins/NCCD student book).
 * Source of truth: data/iqra_curriculum_g2_math_sem2.json
 *
 * Built through `makeNccdCatalog` — see `nccdCatalog.ts`. Same series and box
 * conventions as g2MathSem1.ts: the per-lesson objectives box is printed
 * under «أَتَعَلَّمُ الْيَوْمَ», not «فِكْرَةُ الدَّرْسِ»; `main_idea_ar` stays empty
 * because this book never prints «الفِكْرَةُ الرَّئيسَةُ» at all.
 *
 * Units continue the book's own numbering from Semester 1 (6-10): الضَّرْبُ,
 * الْقِسْمَةُ, الْكُسورُ وَالْأَشْكالُ الْهَنْدَسِيَّة, الزَّمَنُ وَالنُّقود, الْقِياس.
 * `vocabulary` comes from the «المُصْطَلَحات» box where the book prints one;
 * several lessons have none at all. `general_idea_ar`/`prior_knowledge` stay
 * empty for every unit, same finding as g2MathSem1.ts.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g2_math_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G2_MATH_S2_BOOK_ID = 'kb-math-2-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G2_MATH_S2_CURRICULUM_BOOK_ID = 'book-math-2-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-2', subject: 'math', semester: 2 },
  kbBookId: G2_MATH_S2_BOOK_ID,
  browserBookId: G2_MATH_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG2MathSem2: NccdCurriculumFile = catalog.curriculum;
export const g2MathSem2UnitKbId = catalog.unitKbId;
export const g2MathSem2LessonKbId = catalog.lessonKbId;
export const findG2MathSem2LessonByKbId = catalog.findLessonByKbId;
export const buildG2MathSem2Catalog = catalog.buildCatalog;
export const buildG2MathSem2BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G2MathSem2Lesson };
