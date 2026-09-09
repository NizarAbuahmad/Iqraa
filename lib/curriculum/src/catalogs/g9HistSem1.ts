/**
 * Grade 9 History (التاريخ) — Semester 1 (NCCD student book).
 *
 * New subjectId `history`, internal tag stem `hist` (see curriculumIds.ts).
 * Same shape as Geography: a unit-level «الفكرة العامة» (→ general_idea_ar)
 * plus a per-lesson «الفكرة الرئيسة» (→ main_idea_ar) and bilingual
 * «المصطلحات» terms (→ vocabulary). No teacher guide exists, so objectives
 * stay empty. Each lesson opener also prints «الأشخاص»/«الأماكن» boxes
 * (names of historical figures and places, not defined concepts) that have
 * no field in this schema and were not carried over — see known_gaps.
 */

import raw from '../data/iqra_curriculum_g9_history_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G9_HIST_S1_BOOK_ID = 'kb-hist-9-s1';
export const G9_HIST_S1_CURRICULUM_BOOK_ID = 'book-hist-9-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-9', subject: 'hist', semester: 1 },
  kbBookId: G9_HIST_S1_BOOK_ID,
  browserBookId: G9_HIST_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG9HistSem1: NccdCurriculumFile = catalog.curriculum;
export const g9HistSem1UnitKbId = catalog.unitKbId;
export const g9HistSem1LessonKbId = catalog.lessonKbId;
export const findG9HistSem1LessonByKbId = catalog.findLessonByKbId;
export const buildG9HistSem1Catalog = catalog.buildCatalog;
export const buildG9HistSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G9HistSem1Lesson };
