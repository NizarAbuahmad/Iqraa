/**
 * Grade 7 Art, Music and Drama Education (التربية الفنّيّة والموسيقيّة
 * والمسرحيّة) — NCCD student book. Same one-book-no-semester shape as the
 * Grade 8 precedent: `CurriculumIdScope.semester` is set to 1 as a technical
 * id-namespacing placeholder, not a claim this is a Semester 1 book.
 *
 * The 161-page teacher guide that ships alongside this student book turned
 * out to be for an entirely different, older curriculum edition (2016, art
 * only, no music, non-matching lesson titles) — not used for anything; see
 * the JSON's known_gaps.
 */

import raw from '../data/iqra_curriculum_g7_creative_arts.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G7_CREATIVE_ARTS_BOOK_ID = 'kb-arts-7';
export const G7_CREATIVE_ARTS_CURRICULUM_BOOK_ID = 'book-arts-7';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-7', subject: 'arts', semester: 1 },
  kbBookId: G7_CREATIVE_ARTS_BOOK_ID,
  browserBookId: G7_CREATIVE_ARTS_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG7CreativeArts: NccdCurriculumFile = catalog.curriculum;
export const g7CreativeArtsUnitKbId = catalog.unitKbId;
export const g7CreativeArtsLessonKbId = catalog.lessonKbId;
export const findG7CreativeArtsLessonByKbId = catalog.findLessonByKbId;
export const buildG7CreativeArtsCatalog = catalog.buildCatalog;
export const buildG7CreativeArtsBrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G7CreativeArtsLesson };
