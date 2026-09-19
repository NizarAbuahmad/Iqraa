/**
 * Grade 2 Science (العلوم) — Semester 2 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g2_science_sem2.json
 *
 * Built through `makeNccdCatalog` — same box conventions as
 * g2ScienceSem1.ts. Units continue the book's own numbering from Semester 1
 * (4-6): جِسْمُ الْإِنْسانِ وَصِحَّتُهُ, الصَّوْتُ وَالضَّوْءُ, الْمادَّةُ.
 *
 * `objectives` and `prior_knowledge` are empty throughout: the student book
 * prints no «نتاجاتُ التعلُّمِ» box and no «تعلَّمْتُ سابقًا» box.
 *
 * Only the numbered lessons in each unit's own «قائِمَةُ الدُّروسِ» are
 * carried: 3 units, 2+2+3 lessons. «الإِثْراءُ وَالتَّوَسُّعُ» and
 * «مُراجَعَةُ الوَحْدَةِ» are absent — the book gives them no lesson number.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g2_science_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G2_SCIENCE_S2_BOOK_ID = 'kb-science-2-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G2_SCIENCE_S2_CURRICULUM_BOOK_ID = 'book-science-2-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-2', subject: 'science', semester: 2 },
  kbBookId: G2_SCIENCE_S2_BOOK_ID,
  browserBookId: G2_SCIENCE_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG2ScienceSem2: NccdCurriculumFile = catalog.curriculum;
export const g2ScienceSem2UnitKbId = catalog.unitKbId;
export const g2ScienceSem2LessonKbId = catalog.lessonKbId;
export const findG2ScienceSem2LessonByKbId = catalog.findLessonByKbId;
export const buildG2ScienceSem2Catalog = catalog.buildCatalog;
export const buildG2ScienceSem2BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G2ScienceSem2Lesson };
