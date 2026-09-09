/**
 * Grade 8 Vocational Education (التربية المهنية) — Semester 1 (NCCD
 * student book). Seven units, each its own vocational track (life skills,
 * home economics, agriculture, health/safety, industry, entrepreneurship,
 * tourism) — one book covering all seven, not a mistake in transcription.
 *
 * Same shape as Grade 8 Financial Literacy: real objectives from each
 * lesson's own «ماذا سأتعلم؟» box and bilingual vocabulary from its own
 * «المفاهيم والمصطلحات» box — no teacher guide needed.
 */

import raw from '../data/iqra_curriculum_g8_vocational_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G8_VOC_S1_BOOK_ID = 'kb-voc-8-s1';
export const G8_VOC_S1_CURRICULUM_BOOK_ID = 'book-voc-8-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-8', subject: 'voc', semester: 1 },
  kbBookId: G8_VOC_S1_BOOK_ID,
  browserBookId: G8_VOC_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG8VocSem1: NccdCurriculumFile = catalog.curriculum;
export const g8VocSem1UnitKbId = catalog.unitKbId;
export const g8VocSem1LessonKbId = catalog.lessonKbId;
export const findG8VocSem1LessonByKbId = catalog.findLessonByKbId;
export const buildG8VocSem1Catalog = catalog.buildCatalog;
export const buildG8VocSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G8VocSem1Lesson };
