/**
 * Grade 3 Art, Music and Drama Education (التربية الفنّيّة والموسيقيّة
 * والمسرحيّة) — NCCD student book.
 *
 * Like g4CreativeArts/g8CreativeArts, this one is not split by semester — one
 * title, three units (Art, Music, Drama) covering the whole year.
 * `CurriculumIdScope.semester` still requires a number for id-namespacing
 * (`kbu-arts-3-nccd-u1`, etc.), so it is set to 1 here as a technical
 * placeholder — it does not mean this is a Semester 1 book, and no Semester 2
 * counterpart exists or is expected.
 *
 * main_idea_ar is transcribed for all 30 lessons from each lesson's own
 * "الفِكْرَةُ الرَّئيسَة" box. Unlike g4CreativeArts, this book's box position on
 * the page is not consistent (PyMuPDF column-ordering varies by unit), so the
 * source JSON's known_gaps documents how each lesson's sentence was chosen.
 * objectives/vocabulary are left empty; see the JSON's known_gaps.
 *
 * This subject reaches grade-3 only when `SUBJECTS.grades` is extended for
 * it — it had been declared for grade-4/6/7/8 alone, which would have left
 * the book catalogued and permanently unreachable. See catalog.ts.
 */

import raw from '../data/iqra_curriculum_g3_creative_arts.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G3_CREATIVE_ARTS_BOOK_ID = 'kb-arts-3';
export const G3_CREATIVE_ARTS_CURRICULUM_BOOK_ID = 'book-arts-3';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-3', subject: 'arts', semester: 1 },
  kbBookId: G3_CREATIVE_ARTS_BOOK_ID,
  browserBookId: G3_CREATIVE_ARTS_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG3CreativeArts: NccdCurriculumFile = catalog.curriculum;
export const g3CreativeArtsUnitKbId = catalog.unitKbId;
export const g3CreativeArtsLessonKbId = catalog.lessonKbId;
export const findG3CreativeArtsLessonByKbId = catalog.findLessonByKbId;
export const buildG3CreativeArtsCatalog = catalog.buildCatalog;
export const buildG3CreativeArtsBrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G3CreativeArtsLesson };
