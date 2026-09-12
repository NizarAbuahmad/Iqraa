/**
 * Grade 7 Vocational Education (التربية المهنية) — Semester 1 (NCCD student
 * book). Seven units, each its own vocational track (positive behavior,
 * practical skills, leadership, agriculture, home safety, home industries,
 * electricity) — one book covering all seven, not a mistake in
 * transcription. Same shape as the Grade 8 precedent: real objectives from
 * each lesson's own «ماذا سأتعلم؟» box and bilingual vocabulary from its
 * own «المفاهيم والمصطلحات» box — no teacher guide needed.
 */

import raw from '../data/iqra_curriculum_g7_vocational_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G7_VOC_S1_BOOK_ID = 'kb-voc-7-s1';
export const G7_VOC_S1_CURRICULUM_BOOK_ID = 'book-voc-7-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-7', subject: 'voc', semester: 1 },
  kbBookId: G7_VOC_S1_BOOK_ID,
  browserBookId: G7_VOC_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG7VocSem1: NccdCurriculumFile = catalog.curriculum;
export const g7VocSem1UnitKbId = catalog.unitKbId;
export const g7VocSem1LessonKbId = catalog.lessonKbId;
export const findG7VocSem1LessonByKbId = catalog.findLessonByKbId;
export const buildG7VocSem1Catalog = catalog.buildCatalog;
export const buildG7VocSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G7VocSem1Lesson };
