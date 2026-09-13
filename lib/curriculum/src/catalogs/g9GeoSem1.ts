/**
 * Grade 9 Geography (الجغرافيا) — Semester 1 (NCCD student book).
 *
 * The first geography book in this repo — a new subject, not a new grade of
 * an existing one. `geography` is a new app subjectId and `geo` a new
 * internal tag stem (see curriculumIds.ts).
 *
 * This book prints no numbered نتاجات التعلم; instead each lesson opener
 * carries a single «الفكرة الرئيسة» paragraph (→ main_idea_ar) and each unit
 * opener carries a «الفكرة العامة» paragraph (→ general_idea_ar) — the first
 * Grade 9 subject this session where the unit-level field is non-empty. No
 * teacher guide is registered for this subject, so `objectives` is empty
 * throughout, same precedent as Islamic Education.
 */

import raw from '../data/iqra_curriculum_g9_geography_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G9_GEO_S1_BOOK_ID = 'kb-geo-9-s1';
export const G9_GEO_S1_CURRICULUM_BOOK_ID = 'book-geo-9-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-9', subject: 'geo', semester: 1 },
  kbBookId: G9_GEO_S1_BOOK_ID,
  browserBookId: G9_GEO_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG9GeoSem1: NccdCurriculumFile = catalog.curriculum;
export const g9GeoSem1UnitKbId = catalog.unitKbId;
export const g9GeoSem1LessonKbId = catalog.lessonKbId;
export const findG9GeoSem1LessonByKbId = catalog.findLessonByKbId;
export const buildG9GeoSem1Catalog = catalog.buildCatalog;
export const buildG9GeoSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G9GeoSem1Lesson };
