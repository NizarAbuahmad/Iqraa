/**
 * Grade 4 Vocational Education (التربية المهنية) — Semester 2 (NCCD
 * student book). Eight units — not a continuation of Semester 1's seven;
 * this book's own unit numbering restarts at 1, same convention as
 * g8VocationalSem1.ts/g8VocationalSem2.ts for this subject.
 *
 * Real content, but extracted differently from Semester 1: this PDF's text
 * layer is not corrupted in the ToUnicode-CMap sense documented for
 * g5SocialSem1.ts (the Unicode codepoints are correct), but PyMuPDF still
 * extracts each lesson's body text with scrambled intra-word character
 * order — unit headers extract cleanly, lesson content does not. main_idea_ar
 * and general_idea_ar here were hand-reconstructed by reading the scrambled
 * output directly rather than copy-pasted; see the JSON's known_gaps for the
 * full explanation and the caveat on accuracy.
 */

import raw from '../data/iqra_curriculum_g4_vocational_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G4_VOC_S2_BOOK_ID = 'kb-voc-4-s2';
export const G4_VOC_S2_CURRICULUM_BOOK_ID = 'book-voc-4-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-4', subject: 'voc', semester: 2 },
  kbBookId: G4_VOC_S2_BOOK_ID,
  browserBookId: G4_VOC_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG4VocSem2: NccdCurriculumFile = catalog.curriculum;
export const g4VocSem2UnitKbId = catalog.unitKbId;
export const g4VocSem2LessonKbId = catalog.lessonKbId;
export const findG4VocSem2LessonByKbId = catalog.findLessonByKbId;
export const buildG4VocSem2Catalog = catalog.buildCatalog;
export const buildG4VocSem2BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G4VocSem2Lesson };
