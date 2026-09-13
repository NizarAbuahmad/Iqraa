/**
 * Grade 7 Digital Skills (المهارات الرقمية) — Semester 1 (NCCD student book +
 * teacher guide). Real numbered «نتاجات التعلم» and per-lesson periods from
 * the teacher guide's pacing matrix — see the JSON's known_gaps for a
 * genuine internal contradiction found between the guide's per-lesson
 * "عدد الحصص المقترحة" box (wrong for Unit 1) and its own pacing matrix
 * (used instead, since it's arithmetically consistent).
 *
 * `digital-literacy` already spans every grade; this only adds the Grade 7
 * books.
 */

import raw from '../data/iqra_curriculum_g7_digital_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G7_DIGITAL_S1_BOOK_ID = 'kb-digital-7-s1';
export const G7_DIGITAL_S1_CURRICULUM_BOOK_ID = 'book-digital-7-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-7', subject: 'digital', semester: 1 },
  kbBookId: G7_DIGITAL_S1_BOOK_ID,
  browserBookId: G7_DIGITAL_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG7DigitalSem1: NccdCurriculumFile = catalog.curriculum;
export const g7DigitalSem1UnitKbId = catalog.unitKbId;
export const g7DigitalSem1LessonKbId = catalog.lessonKbId;
export const findG7DigitalSem1LessonByKbId = catalog.findLessonByKbId;
export const buildG7DigitalSem1Catalog = catalog.buildCatalog;
export const buildG7DigitalSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G7DigitalSem1Lesson };
