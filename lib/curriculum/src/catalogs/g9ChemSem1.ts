/**
 * Grade 9 Chemistry (الكيمياء) — Semester 1 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g9_chem_sem1.json
 *
 * Built through `makeNccdCatalog` rather than by copying one of the twenty-two
 * hand-written builders beside it — see `nccdCatalog.ts` for why.
 *
 * Grade 9 chemistry existed nowhere before 2026-09-08, and not for want of a
 * book: `chemistry` was declared `GRADES.slice(9)` in catalog.ts, so
 * `getSubjectsForGrade('grade-9')` dropped the subject before any book could
 * be found. `SPECIALISED_FROM` fixed that; this file supplies the content.
 *
 * Periods are null throughout. No Grade 9 chemistry teacher guide for
 * semester 1 is on disk — only the semester 2 guide — and period counts are a
 * teacher-guide field. Outcomes and vocabulary are NOT missing: this book
 * prints «نتاجاتُ التعلُّمِ» and a bilingual «المفاهيمُ والمصطلحاتُ» on every
 * lesson opener and both are transcribed in full.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g9_chem_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G9_CHEM_S1_BOOK_ID = 'kb-chem-9-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G9_CHEM_S1_CURRICULUM_BOOK_ID = 'book-chem-9-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-9', subject: 'chem', semester: 1 },
  kbBookId: G9_CHEM_S1_BOOK_ID,
  browserBookId: G9_CHEM_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG9ChemSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g9-chem-s1-nccd-u1). */
export const g9ChemSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g9-chem-s1-nccd-u1_l1). */
export const g9ChemSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG9ChemSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG9ChemSem1Catalog = catalog.buildCatalog;
export const buildG9ChemSem1BrowserCatalog = catalog.buildBrowserCatalog;
