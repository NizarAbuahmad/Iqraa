/**
 * Grade 8 Digital Skills (المهارات الرقمية) — Semester 1 (NCCD student
 * book). Same shape as Financial Literacy Grade 8: real numbered «نتاجات
 * التعلم» per lesson, no teacher guide needed.
 *
 * `digital-literacy` already spans every grade; this only adds the Grade 8
 * books.
 */

import raw from '../data/iqra_curriculum_g8_digital_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G8_DIGITAL_S1_BOOK_ID = 'kb-digital-8-s1';
export const G8_DIGITAL_S1_CURRICULUM_BOOK_ID = 'book-digital-8-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-8', subject: 'digital', semester: 1 },
  kbBookId: G8_DIGITAL_S1_BOOK_ID,
  browserBookId: G8_DIGITAL_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG8DigitalSem1: NccdCurriculumFile = catalog.curriculum;
export const g8DigitalSem1UnitKbId = catalog.unitKbId;
export const g8DigitalSem1LessonKbId = catalog.lessonKbId;
export const findG8DigitalSem1LessonByKbId = catalog.findLessonByKbId;
export const buildG8DigitalSem1Catalog = catalog.buildCatalog;
export const buildG8DigitalSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G8DigitalSem1Lesson };
