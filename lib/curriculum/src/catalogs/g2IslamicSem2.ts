/**
 * Grade 2 Islamic Education (التربية الإسلامية) — Semester 2 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g2_islamic_sem2.json
 *
 * Built through `makeNccdCatalog` — same box conventions as g2IslamicSem1.ts.
 * Units restart at 1-4 here (not 5-8): this book's own table of contents
 * prints «الْوَحْدَةُ الأولى» for its first Semester 2 unit, same restart-per-
 * semester convention as g1IslamicSem2.ts.
 *
 * `objectives` and `vocabulary` are empty throughout: the student book
 * prints no «نتاجاتُ التعلُّمِ» box and no bilingual terms box.
 * `general_idea_ar`/`prior_knowledge` stay empty for every unit, same
 * finding as g2IslamicSem1.ts.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g2_islamic_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G2_ISLAMIC_S2_BOOK_ID = 'kb-islamic-2-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G2_ISLAMIC_S2_CURRICULUM_BOOK_ID = 'book-islamic-2-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-2', subject: 'islamic', semester: 2 },
  kbBookId: G2_ISLAMIC_S2_BOOK_ID,
  browserBookId: G2_ISLAMIC_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG2IslamicSem2: NccdCurriculumFile = catalog.curriculum;
export const g2IslamicSem2UnitKbId = catalog.unitKbId;
export const g2IslamicSem2LessonKbId = catalog.lessonKbId;
export const findG2IslamicSem2LessonByKbId = catalog.findLessonByKbId;
export const buildG2IslamicSem2Catalog = catalog.buildCatalog;
export const buildG2IslamicSem2BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G2IslamicSem2Lesson };
