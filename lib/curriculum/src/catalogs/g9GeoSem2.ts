/**
 * Grade 9 Geography (الجغرافيا) — Semester 2 (NCCD student book).
 * Same shape as Semester 1: general_idea_ar and main_idea_ar come from the
 * book's own printed boxes; objectives stay empty (no teacher guide).
 */

import raw from '../data/iqra_curriculum_g9_geography_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G9_GEO_S2_BOOK_ID = 'kb-geo-9-s2';
export const G9_GEO_S2_CURRICULUM_BOOK_ID = 'book-geo-9-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-9', subject: 'geo', semester: 2 },
  kbBookId: G9_GEO_S2_BOOK_ID,
  browserBookId: G9_GEO_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG9GeoSem2: NccdCurriculumFile = catalog.curriculum;
export const g9GeoSem2UnitKbId = catalog.unitKbId;
export const g9GeoSem2LessonKbId = catalog.lessonKbId;
export const findG9GeoSem2LessonByKbId = catalog.findLessonByKbId;
export const buildG9GeoSem2Catalog = catalog.buildCatalog;
export const buildG9GeoSem2BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G9GeoSem2Lesson };
