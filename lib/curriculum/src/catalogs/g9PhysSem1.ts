/**
 * Grade 9 Physics (الفيزياء) — Semester 1 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g9_phys_sem1.json
 *
 * Built through `makeNccdCatalog` — see `nccdCatalog.ts`.
 *
 * `phys` is `unitLevel: false` in curriculumIds.ts, so a unit here resolves to
 * the semester tag `g9-phys-s1` alone and never `g9-phys-s1-u2`. That is a
 * statement about the document bank, not about the curriculum: no Grade 9
 * physics document is scoped narrower than a semester, so emitting a unit tag
 * would invent one nothing carries.
 *
 * Periods are null throughout — no Grade 9 physics teacher guide for semester
 * 1 is on disk. Outcomes and vocabulary are present: this book prints
 * «نتاجاتُ التعلُّمِ» and «المفاهيمُ والمصطلحاتُ» on every lesson opener.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g9_phys_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G9_PHYS_S1_BOOK_ID = 'kb-phys-9-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G9_PHYS_S1_CURRICULUM_BOOK_ID = 'book-phys-9-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-9', subject: 'phys', semester: 1 },
  kbBookId: G9_PHYS_S1_BOOK_ID,
  browserBookId: G9_PHYS_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG9PhysSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g9-phys-s1-nccd-u1). */
export const g9PhysSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g9-phys-s1-nccd-u1_l1). */
export const g9PhysSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG9PhysSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG9PhysSem1Catalog = catalog.buildCatalog;
export const buildG9PhysSem1BrowserCatalog = catalog.buildBrowserCatalog;
