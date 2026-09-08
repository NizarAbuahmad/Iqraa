/**
 * Grade 9 Physics (الفيزياء) — Semester 2 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g9_phys_sem2.json
 *
 * Mirrors g9PhysSem1.ts. Units are numbered 4 and 5: numbering runs across
 * both semesters here, as it does in Grade 9 chemistry, and the numbers are
 * printed on the unit opener pages rather than inferred from the contents
 * order — Islamic Education restarts at 1 each semester, so the convention
 * has to be read off the page rather than assumed from a sibling subject.
 *
 * Periods are null even though this semester's teacher guide IS on disk
 * (knowledge-base/grade-9-physics/support-pdfs); it was deliberately left
 * unregistered in the breadth pass.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g9_phys_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G9_PHYS_S2_BOOK_ID = 'kb-phys-9-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G9_PHYS_S2_CURRICULUM_BOOK_ID = 'book-phys-9-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-9', subject: 'phys', semester: 2 },
  kbBookId: G9_PHYS_S2_BOOK_ID,
  browserBookId: G9_PHYS_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG9PhysSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u4 → kbu-g9-phys-s2-nccd-u4). */
export const g9PhysSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u4_l1 → kbl-g9-phys-s2-nccd-u4_l1). */
export const g9PhysSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG9PhysSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG9PhysSem2Catalog = catalog.buildCatalog;
export const buildG9PhysSem2BrowserCatalog = catalog.buildBrowserCatalog;
