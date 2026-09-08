/**
 * Grade 9 Chemistry (الكيمياء) — Semester 2 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g9_chem_sem2.json
 *
 * Mirrors g9ChemSem1.ts, and like it goes through `makeNccdCatalog`.
 *
 * **Units are numbered 3 and 4, not 1 and 2.** Unit numbering runs across both
 * semesters in this subject, and the numbers are printed on the unit opener
 * pages (7 and 37) rather than inferred from the order of the contents page.
 * That check is not ceremony: Islamic Education restarts at 1 each semester,
 * so the two conventions coexist in this repo and reading the opener is the
 * only way to tell which one a book follows.
 *
 * Periods are null throughout even though this semester's teacher guide IS on
 * disk (knowledge-base/grade-9-chemistry/support-pdfs). It was deliberately
 * left unregistered and unextracted: registering a source without extracting
 * it grows the pending backlog for no gain, and the breadth pass reads the
 * student book alone. This is the nearest gap to closing.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g9_chem_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G9_CHEM_S2_BOOK_ID = 'kb-chem-9-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G9_CHEM_S2_CURRICULUM_BOOK_ID = 'book-chem-9-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-9', subject: 'chem', semester: 2 },
  kbBookId: G9_CHEM_S2_BOOK_ID,
  browserBookId: G9_CHEM_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG9ChemSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u3 → kbu-g9-chem-s2-nccd-u3). */
export const g9ChemSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u3_l1 → kbl-g9-chem-s2-nccd-u3_l1). */
export const g9ChemSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG9ChemSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG9ChemSem2Catalog = catalog.buildCatalog;
export const buildG9ChemSem2BrowserCatalog = catalog.buildBrowserCatalog;
