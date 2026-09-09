/**
 * Grade 10 Geography (الجغرافيا) — Semester 1 (NCCD student book).
 *
 * Extends the `geography` subject (introduced 2026-09-09 as a Grade 9-only
 * subject) to Grade 10. Same `geo` tag stem — grade-10 is
 * `curriculumIds.ts`'s implicit grade, so these units carry bare tags
 * (`geo-s1`) with no grade segment, distinct from Grade 9's `g9-geo-s1`.
 *
 * Same shape as the Grade 9 book: a unit-level «الفكرة العامة» populates
 * general_idea_ar, a per-lesson «الفكرة الرئيسة» populates main_idea_ar, and
 * a bilingual «المفاهيم والمصطلحات» box populates vocabulary. No teacher
 * guide exists, so objectives stay empty.
 */

import raw from '../data/iqra_curriculum_g10_geography_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const GEO_S1_BOOK_ID = 'kb-geo-10-s1';
export const GEO_S1_CURRICULUM_BOOK_ID = 'book-geo-10-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-10', subject: 'geo', semester: 1 },
  kbBookId: GEO_S1_BOOK_ID,
  browserBookId: GEO_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdGeoSem1: NccdCurriculumFile = catalog.curriculum;
export const geoSem1UnitKbId = catalog.unitKbId;
export const geoSem1LessonKbId = catalog.lessonKbId;
export const findGeoSem1LessonByKbId = catalog.findLessonByKbId;
export const buildGeoSem1Catalog = catalog.buildCatalog;
export const buildGeoSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as GeoSem1Lesson };
