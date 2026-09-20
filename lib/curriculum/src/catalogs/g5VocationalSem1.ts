/**
 * Grade 5 Vocational Education (التربية المهنية) — Semester 1 (NCCD
 * student book). Seven units (life skills, entrepreneurship, agriculture,
 * home economics, safety/health/environment, woodworking, hospitality and
 * tourism) — the same seven tracks as g4VocationalSem1.ts, in a different
 * order.
 *
 * Real content: main_idea_ar, objectives and vocabulary all come from each
 * lesson's own opener boxes («الفِكْرَةُ الرَّئيسَةُ», «ماذا سَأَتَعَلَّمُ؟»,
 * «المَفاهيمُ وَالمُصْطَلَحاتُ») — this book's PDF extracts cleanly through
 * PyMuPDF (unlike Semester 2, see g5VocationalSem2.ts), aside from a
 * doubled-diacritic rendering artifact that was normalized on the way in.
 * Unlike g4VocationalSem1.ts, objectives/vocabulary were transcribed from
 * the start rather than deferred to a later pass.
 *
 * This book had never been built despite existing on disk for both
 * semesters — discovered via a cross-check against the official NCCD
 * textbook list. `SUBJECTS.grades` for `vocational-education` did not
 * include `'grade-5'` (only grade-4, grade-6..grade-8), which would have
 * left this catalog built but unreachable from the curriculum browser — see
 * catalog.ts.
 */

import raw from '../data/iqra_curriculum_g5_vocational_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G5_VOC_S1_BOOK_ID = 'kb-voc-5-s1';
export const G5_VOC_S1_CURRICULUM_BOOK_ID = 'book-voc-5-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-5', subject: 'voc', semester: 1 },
  kbBookId: G5_VOC_S1_BOOK_ID,
  browserBookId: G5_VOC_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG5VocSem1: NccdCurriculumFile = catalog.curriculum;
export const g5VocSem1UnitKbId = catalog.unitKbId;
export const g5VocSem1LessonKbId = catalog.lessonKbId;
export const findG5VocSem1LessonByKbId = catalog.findLessonByKbId;
export const buildG5VocSem1Catalog = catalog.buildCatalog;
export const buildG5VocSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G5VocSem1Lesson };
