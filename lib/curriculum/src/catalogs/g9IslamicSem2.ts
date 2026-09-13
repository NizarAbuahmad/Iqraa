/**
 * Grade 9 Islamic Education (التربية الإسلامية) — Semester 2 (NCCD student book).
 *
 * Same shape as Semester 1: no نتاجات التعلم box on any lesson opener and no
 * teacher guide on disk, so `objectives` is empty for every lesson. Unlike
 * Semester 1's contents page, this book's contents page (p4) prints full
 * descriptive lesson titles, so those were copied from there rather than
 * from each lesson's own opener page — only `main_idea_ar` (the «الفكرة
 * الرئيسة» box) came from the rasterized lesson-opener images.
 */

import raw from '../data/iqra_curriculum_g9_islamic_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G9_ISLAMIC_S2_BOOK_ID = 'kb-islamic-9-s2';
export const G9_ISLAMIC_S2_CURRICULUM_BOOK_ID = 'book-islamic-9-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-9', subject: 'islamic', semester: 2 },
  kbBookId: G9_ISLAMIC_S2_BOOK_ID,
  browserBookId: G9_ISLAMIC_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG9IslamicSem2: NccdCurriculumFile = catalog.curriculum;
export const g9IslamicSem2UnitKbId = catalog.unitKbId;
export const g9IslamicSem2LessonKbId = catalog.lessonKbId;
export const findG9IslamicSem2LessonByKbId = catalog.findLessonByKbId;
export const buildG9IslamicSem2Catalog = catalog.buildCatalog;
export const buildG9IslamicSem2BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G9IslamicSem2Lesson };
