/**
 * Grade 5 Science (العلوم) — Semester 1 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g5_science_sem1.json
 *
 * Built through `makeNccdCatalog` — this book prints the exact shape that
 * factory assumes on every lesson opener («الفِكْرَةُ الرَّئيسَةُ» and a
 * bilingual «المَفاهيمُ وَالمُصْطَلَحاتُ») and on every unit opener
 * («الفِكْرَةُ العامَّةُ»), same as g6ScienceSem1.
 *
 * Like g6ScienceSem1, `objectives` and `prior_knowledge` are empty
 * throughout: the student book prints no «نتاجاتُ التعلُّمِ» box and no
 * «تعلَّمْتُ سابقًا» box — unlike this same grade's math book, which does
 * print the latter. Read directly from the student book PDF with PyMuPDF,
 * not from any pdf-parse dump.
 *
 * Only the eleven numbered lessons are carried, matching the printed table
 * of contents exactly: 5 units, 2+3+2+2+2 lessons. «الإثْراءُ وَالتَّوَسُّعُ»
 * and «مُراجَعَةُ الوَحْدَةِ» are absent — the book gives them no lesson
 * number.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g5_science_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G5_SCIENCE_S1_BOOK_ID = 'kb-science-5-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G5_SCIENCE_S1_CURRICULUM_BOOK_ID = 'book-science-5-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-5', subject: 'science', semester: 1 },
  kbBookId: G5_SCIENCE_S1_BOOK_ID,
  browserBookId: G5_SCIENCE_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG5ScienceSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g5-science-s1-nccd-u1). */
export const g5ScienceSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g5-science-s1-nccd-u1_l1). */
export const g5ScienceSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG5ScienceSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG5ScienceSem1Catalog = catalog.buildCatalog;
export const buildG5ScienceSem1BrowserCatalog = catalog.buildBrowserCatalog;
