/**
 * Grade 5 Vocational Education (التربية المهنية) — Semester 2 (NCCD
 * student book). Seven units — not a continuation of Semester 1's seven;
 * this book's own unit numbering restarts at 1, same convention as
 * g4VocationalSem2.ts/g8VocationalSem2.ts for this subject.
 *
 * Real content, but extracted differently from Semester 1: this PDF's
 * Unicode codepoints are correct (no CMap corruption, unlike g5SocialSem1.ts)
 * and unit/lesson titles extract cleanly, but the body text of many boxes
 * comes out with word order reversed within each line — an RTL rendering
 * quirk distinct from Semester 1's doubled-diacritic artifact and distinct
 * from Semester 2 of the Grade 4 book (which scrambles character order
 * within words, not word order within lines). main_idea_ar and
 * general_idea_ar here were hand-reconstructed by reversing word order line
 * by line and checking the result against each unit's/lesson's own printed
 * title; see the JSON's known_gaps for the caveat on residual uncertainty.
 */

import raw from '../data/iqra_curriculum_g5_vocational_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G5_VOC_S2_BOOK_ID = 'kb-voc-5-s2';
export const G5_VOC_S2_CURRICULUM_BOOK_ID = 'book-voc-5-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-5', subject: 'voc', semester: 2 },
  kbBookId: G5_VOC_S2_BOOK_ID,
  browserBookId: G5_VOC_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG5VocSem2: NccdCurriculumFile = catalog.curriculum;
export const g5VocSem2UnitKbId = catalog.unitKbId;
export const g5VocSem2LessonKbId = catalog.lessonKbId;
export const findG5VocSem2LessonByKbId = catalog.findLessonByKbId;
export const buildG5VocSem2Catalog = catalog.buildCatalog;
export const buildG5VocSem2BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G5VocSem2Lesson };
