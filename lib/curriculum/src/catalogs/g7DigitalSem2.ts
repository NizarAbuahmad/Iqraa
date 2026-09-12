/**
 * Grade 7 Digital Skills (المهارات الرقمية) — Semester 2 (NCCD student
 * book, no teacher guide). Same shape as Semester 1's schema, minus periods.
 */

import raw from '../data/iqra_curriculum_g7_digital_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G7_DIGITAL_S2_BOOK_ID = 'kb-digital-7-s2';
export const G7_DIGITAL_S2_CURRICULUM_BOOK_ID = 'book-digital-7-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-7', subject: 'digital', semester: 2 },
  kbBookId: G7_DIGITAL_S2_BOOK_ID,
  browserBookId: G7_DIGITAL_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG7DigitalSem2: NccdCurriculumFile = catalog.curriculum;
export const g7DigitalSem2UnitKbId = catalog.unitKbId;
export const g7DigitalSem2LessonKbId = catalog.lessonKbId;
export const findG7DigitalSem2LessonByKbId = catalog.findLessonByKbId;
export const buildG7DigitalSem2Catalog = catalog.buildCatalog;
export const buildG7DigitalSem2BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G7DigitalSem2Lesson };
