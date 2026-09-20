/**
 * Grade 5 Physical Education (التربية الرياضية) — Semester 2 (NCCD student
 * book). Same real-content layout as g5PhysicalEducationSem1.ts. Units
 * continue Semester 1's numbering (5, 6, 7 — printed that way in the book
 * itself, not renumbered from 1): athletics, basketball, and a knowledge-only
 * health-concepts unit whose two lessons carry no technique boxes but do
 * carry the bilingual vocabulary box.
 */

import raw from '../data/iqra_curriculum_g5_physical_education_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G5_PE_S2_BOOK_ID = 'kb-pe-5-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G5_PE_S2_CURRICULUM_BOOK_ID = 'book-pe-5-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-5', subject: 'pe', semester: 2 },
  kbBookId: G5_PE_S2_BOOK_ID,
  browserBookId: G5_PE_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG5PhysicalEducationSem2: NccdCurriculumFile = catalog.curriculum;
export const g5PhysicalEducationSem2UnitKbId = catalog.unitKbId;
export const g5PhysicalEducationSem2LessonKbId = catalog.lessonKbId;
export const findG5PhysicalEducationSem2LessonByKbId = catalog.findLessonByKbId;
export const buildG5PhysicalEducationSem2Catalog = catalog.buildCatalog;
export const buildG5PhysicalEducationSem2BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G5PhysicalEducationSem2Lesson };
