/**
 * Grade 2 Math (الرياضيات) — Semester 1 (HarperCollins/NCCD student book).
 * Source of truth: data/iqra_curriculum_g2_math_sem1.json
 *
 * Built through `makeNccdCatalog` — see `nccdCatalog.ts`. Same series and box
 * conventions as g1MathSem1/g3MathSem1/g4MathSem1/g5MathSem1/g10 Math: the
 * per-lesson objectives box is printed under «أَتَعَلَّمُ الْيَوْمَ», not «فِكْرَةُ
 * الدَّرْسِ»; `main_idea_ar` stays empty because this book never prints
 * «الفِكْرَةُ الرَّئيسَةُ» at all.
 *
 * This book has no unnumbered preparatory unit — Unit 1 («الأَعْدادُ») is the
 * first unit printed. `vocabulary` comes from the «المُصْطَلَحات» box where the
 * book prints one; several lessons have none at all. `general_idea_ar`/
 * `prior_knowledge` stay empty for every unit — the opener page carries only
 * a family letter («أُسْرَتي الْكَريمَة») and a unit project, no «ما أهمية هذه
 * الوحدة؟» box, same finding as g1MathSem1.ts.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g2_math_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G2_MATH_S1_BOOK_ID = 'kb-math-2-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G2_MATH_S1_CURRICULUM_BOOK_ID = 'book-math-2-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-2', subject: 'math', semester: 1 },
  kbBookId: G2_MATH_S1_BOOK_ID,
  browserBookId: G2_MATH_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG2MathSem1: NccdCurriculumFile = catalog.curriculum;
export const g2MathSem1UnitKbId = catalog.unitKbId;
export const g2MathSem1LessonKbId = catalog.lessonKbId;
export const findG2MathSem1LessonByKbId = catalog.findLessonByKbId;
export const buildG2MathSem1Catalog = catalog.buildCatalog;
export const buildG2MathSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G2MathSem1Lesson };
