/**
 * Grade 8 Art, Music and Drama Education (التربية الفنّيّة والموسيقيّة
 * والمسرحيّة) — NCCD student book. Brand-new subject: no prior art, music or
 * drama subject existed in this catalog.
 *
 * Unlike every other Grade 8 book so far, this one is not split by semester
 * — one title, no «الفصل الأول/الثاني» on the cover, three units (Art,
 * Music, Drama) covering the whole year. `CurriculumIdScope.semester` still
 * requires a number for id-namespacing (`kbu-arts-s1-nccd-u1`, etc.), so it
 * is set to 1 here as a technical placeholder — it does not mean this is a
 * Semester 1 book, and no Semester 2 counterpart exists or is expected.
 */

import raw from '../data/iqra_curriculum_g8_creative_arts.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G8_CREATIVE_ARTS_BOOK_ID = 'kb-arts-8';
export const G8_CREATIVE_ARTS_CURRICULUM_BOOK_ID = 'book-arts-8';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-8', subject: 'arts', semester: 1 },
  kbBookId: G8_CREATIVE_ARTS_BOOK_ID,
  browserBookId: G8_CREATIVE_ARTS_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG8CreativeArts: NccdCurriculumFile = catalog.curriculum;
export const g8CreativeArtsUnitKbId = catalog.unitKbId;
export const g8CreativeArtsLessonKbId = catalog.lessonKbId;
export const findG8CreativeArtsLessonByKbId = catalog.findLessonByKbId;
export const buildG8CreativeArtsCatalog = catalog.buildCatalog;
export const buildG8CreativeArtsBrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G8CreativeArtsLesson };
