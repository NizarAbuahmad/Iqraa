/**
 * Grade 9 Vocational Education (التربية المهنية) — Semester 2 (NCCD
 * student book, first trial edition 2025). Nine units across seven printed
 * vocational tracks (home economics, life skills, entrepreneurship,
 * agriculture, security/health/safety, industry, tourism and hospitality).
 * Same shape as g9VocationalSem1.ts.
 *
 * Unit numbers run 1–9 because the book itself prints الوحدة الأولى …
 * الوحدة التاسعة within this semester; ids are scoped by semester, so they
 * cannot collide with Semester 1's.
 */

import raw from '../data/iqra_curriculum_g9_vocational_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G9_VOC_S2_BOOK_ID = 'kb-voc-9-s2';
export const G9_VOC_S2_CURRICULUM_BOOK_ID = 'book-voc-9-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-9', subject: 'voc', semester: 2 },
  kbBookId: G9_VOC_S2_BOOK_ID,
  browserBookId: G9_VOC_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG9VocSem2: NccdCurriculumFile = catalog.curriculum;
export const g9VocSem2UnitKbId = catalog.unitKbId;
export const g9VocSem2LessonKbId = catalog.lessonKbId;
export const findG9VocSem2LessonByKbId = catalog.findLessonByKbId;
export const buildG9VocSem2Catalog = catalog.buildCatalog;
export const buildG9VocSem2BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G9VocSem2Lesson };
