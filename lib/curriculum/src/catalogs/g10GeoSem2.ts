/**
 * Grade 10 Geography (الجغرافيا) — Semester 2 (NCCD student book). Same
 * shape as Semester 1.
 */

import raw from '../data/iqra_curriculum_g10_geography_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const GEO_S2_BOOK_ID = 'kb-geo-10-s2';
export const GEO_S2_CURRICULUM_BOOK_ID = 'book-geo-10-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-10', subject: 'geo', semester: 2 },
  kbBookId: GEO_S2_BOOK_ID,
  browserBookId: GEO_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdGeoSem2: NccdCurriculumFile = catalog.curriculum;
export const geoSem2UnitKbId = catalog.unitKbId;
export const geoSem2LessonKbId = catalog.lessonKbId;
export const findGeoSem2LessonByKbId = catalog.findLessonByKbId;
export const buildGeoSem2Catalog = catalog.buildCatalog;
export const buildGeoSem2BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as GeoSem2Lesson };
