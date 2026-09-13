/**
 * Grade 7 Vocational Education (التربية المهنية) — Semester 2 (NCCD student
 * book). Seven more independent vocational tracks (home economics, health/
 * safety/environment, life skills, entrepreneurship, agriculture,
 * industry, tourism/hospitality). Same shape as Semester 1.
 */

import raw from '../data/iqra_curriculum_g7_vocational_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G7_VOC_S2_BOOK_ID = 'kb-voc-7-s2';
export const G7_VOC_S2_CURRICULUM_BOOK_ID = 'book-voc-7-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-7', subject: 'voc', semester: 2 },
  kbBookId: G7_VOC_S2_BOOK_ID,
  browserBookId: G7_VOC_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG7VocSem2: NccdCurriculumFile = catalog.curriculum;
export const g7VocSem2UnitKbId = catalog.unitKbId;
export const g7VocSem2LessonKbId = catalog.lessonKbId;
export const findG7VocSem2LessonByKbId = catalog.findLessonByKbId;
export const buildG7VocSem2Catalog = catalog.buildCatalog;
export const buildG7VocSem2BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G7VocSem2Lesson };
