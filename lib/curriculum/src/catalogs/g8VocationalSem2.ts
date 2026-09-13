/**
 * Grade 8 Vocational Education (التربية المهنية) — Semester 2 (NCCD
 * student book). Same shape as Semester 1 — ten more vocational-track
 * units.
 */

import raw from '../data/iqra_curriculum_g8_vocational_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G8_VOC_S2_BOOK_ID = 'kb-voc-8-s2';
export const G8_VOC_S2_CURRICULUM_BOOK_ID = 'book-voc-8-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-8', subject: 'voc', semester: 2 },
  kbBookId: G8_VOC_S2_BOOK_ID,
  browserBookId: G8_VOC_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG8VocSem2: NccdCurriculumFile = catalog.curriculum;
export const g8VocSem2UnitKbId = catalog.unitKbId;
export const g8VocSem2LessonKbId = catalog.lessonKbId;
export const findG8VocSem2LessonByKbId = catalog.findLessonByKbId;
export const buildG8VocSem2Catalog = catalog.buildCatalog;
export const buildG8VocSem2BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G8VocSem2Lesson };
