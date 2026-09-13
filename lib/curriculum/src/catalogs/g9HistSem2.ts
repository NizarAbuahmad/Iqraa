/**
 * Grade 9 History (التاريخ) — Semester 2 (NCCD student book).
 * Same shape as Semester 1. Unit 5 is six biographical lessons rather than
 * thematic ones; its first two lessons' «المصطلحات» box carries Arabic-only
 * epithets with no printed English gloss, so those vocabulary entries carry
 * an empty `en` rather than an invented translation.
 */

import raw from '../data/iqra_curriculum_g9_history_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G9_HIST_S2_BOOK_ID = 'kb-hist-9-s2';
export const G9_HIST_S2_CURRICULUM_BOOK_ID = 'book-hist-9-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-9', subject: 'hist', semester: 2 },
  kbBookId: G9_HIST_S2_BOOK_ID,
  browserBookId: G9_HIST_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG9HistSem2: NccdCurriculumFile = catalog.curriculum;
export const g9HistSem2UnitKbId = catalog.unitKbId;
export const g9HistSem2LessonKbId = catalog.lessonKbId;
export const findG9HistSem2LessonByKbId = catalog.findLessonByKbId;
export const buildG9HistSem2Catalog = catalog.buildCatalog;
export const buildG9HistSem2BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G9HistSem2Lesson };
