/**
 * Grade 1 Math (الرياضيات) — Semester 1 (HarperCollins/NCCD student book).
 * Source of truth: data/iqra_curriculum_g1_math_sem1.json
 *
 * Built through `makeNccdCatalog` — see `nccdCatalog.ts`. The first Grade 1
 * book in this repo. Same series and box conventions as g3MathSem1/g4MathSem1
 * /g5MathSem1/g10 Math: the per-lesson objectives box is printed under
 * «أَتَعَلَّمُ الْيَوْمَ», not «فِكْرَةُ الدَّرْسِ»; `main_idea_ar` stays empty because
 * this book never prints «الفِكْرَةُ الرَّئيسَةُ» at all.
 *
 * This book opens with an unnumbered preparatory unit («الوَحْدَةُ التَّمْهيدِيَّةُ:
 * الأَعْدادُ حَتّى 10») before the first numbered unit — given number 0 here to
 * keep it distinct without disturbing the book's own 1-5 numbering for the
 * rest. `vocabulary` comes from the «المُصْطَلَحات» box where the book prints
 * one; several lessons have none at all. `general_idea_ar`/`prior_knowledge`
 * stay empty for every unit — the opener page carries only a family letter
 * («أُسْرَتي الْكَريمَة») and a unit project, no «ما أهمية هذه الوحدة؟» box, same
 * finding as g3MathSem1.ts.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g1_math_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G1_MATH_S1_BOOK_ID = 'kb-math-1-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G1_MATH_S1_CURRICULUM_BOOK_ID = 'book-math-1-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-1', subject: 'math', semester: 1 },
  kbBookId: G1_MATH_S1_BOOK_ID,
  browserBookId: G1_MATH_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG1MathSem1: NccdCurriculumFile = catalog.curriculum;
export const g1MathSem1UnitKbId = catalog.unitKbId;
export const g1MathSem1LessonKbId = catalog.lessonKbId;
export const findG1MathSem1LessonByKbId = catalog.findLessonByKbId;
export const buildG1MathSem1Catalog = catalog.buildCatalog;
export const buildG1MathSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G1MathSem1Lesson };
