/**
 * Grade 8 Digital Skills (المهارات الرقمية) — Semester 2 (NCCD student
 * book). Same shape as Semester 1.
 */

import raw from '../data/iqra_curriculum_g8_digital_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G8_DIGITAL_S2_BOOK_ID = 'kb-digital-8-s2';
export const G8_DIGITAL_S2_CURRICULUM_BOOK_ID = 'book-digital-8-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-8', subject: 'digital', semester: 2 },
  kbBookId: G8_DIGITAL_S2_BOOK_ID,
  browserBookId: G8_DIGITAL_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG8DigitalSem2: NccdCurriculumFile = catalog.curriculum;
export const g8DigitalSem2UnitKbId = catalog.unitKbId;
export const g8DigitalSem2LessonKbId = catalog.lessonKbId;
export const findG8DigitalSem2LessonByKbId = catalog.findLessonByKbId;
export const buildG8DigitalSem2Catalog = catalog.buildCatalog;
export const buildG8DigitalSem2BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G8DigitalSem2Lesson };
