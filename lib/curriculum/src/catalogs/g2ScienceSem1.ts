/**
 * Grade 2 Science (العلوم) — Semester 1 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g2_science_sem1.json
 *
 * Built through `makeNccdCatalog` — this book prints the exact shape that
 * factory assumes on every lesson opener («الفِكْرَةُ الرَّئيسَةُ» and a
 * bilingual «المَفاهيمُ وَالمُصْطَلَحاتُ») and on every unit opener
 * («الفِكْرَةُ العامَّةُ»), same as g1ScienceSem1/g3ScienceSem1/g4ScienceSem1
 * /g5ScienceSem1.
 *
 * `objectives` and `prior_knowledge` are empty throughout: the student book
 * prints no «نتاجاتُ التعلُّمِ» box and no «تعلَّمْتُ سابقًا» box.
 *
 * Only the numbered lessons in each unit's own «قائِمَةُ الدُّروسِ» are
 * carried: 3 units, 2+2+2 lessons. «الإِثْراءُ وَالتَّوَسُّعُ» and
 * «مُراجَعَةُ الوَحْدَةِ» are absent — the book gives them no lesson number.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g2_science_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G2_SCIENCE_S1_BOOK_ID = 'kb-science-2-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G2_SCIENCE_S1_CURRICULUM_BOOK_ID = 'book-science-2-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-2', subject: 'science', semester: 1 },
  kbBookId: G2_SCIENCE_S1_BOOK_ID,
  browserBookId: G2_SCIENCE_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG2ScienceSem1: NccdCurriculumFile = catalog.curriculum;
export const g2ScienceSem1UnitKbId = catalog.unitKbId;
export const g2ScienceSem1LessonKbId = catalog.lessonKbId;
export const findG2ScienceSem1LessonByKbId = catalog.findLessonByKbId;
export const buildG2ScienceSem1Catalog = catalog.buildCatalog;
export const buildG2ScienceSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G2ScienceSem1Lesson };
