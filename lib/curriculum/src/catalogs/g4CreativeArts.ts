/**
 * Grade 4 Art, Music and Drama Education (التربية الفنّيّة والموسيقيّة
 * والمسرحيّة) — NCCD student book.
 *
 * Like g8CreativeArts, this one is not split by semester — one title, three
 * units (Art, Music, Drama) covering the whole year. `CurriculumIdScope.semester`
 * still requires a number for id-namespacing (`kbu-arts-4-nccd-u1`, etc.), so
 * it is set to 1 here as a technical placeholder — it does not mean this is a
 * Semester 1 book, and no Semester 2 counterpart exists or is expected.
 *
 * Unlike g8CreativeArts, this book prints its own "الفِكْرَةُ الرَّئيسَة" (main
 * idea) box on every lesson's opener page, so main_idea_ar is transcribed for
 * all 30 lessons directly — no unit-level outcome-list mapping was needed.
 * objectives/vocabulary are left empty; see the JSON's known_gaps.
 *
 * This subject reached grade-4 only when `SUBJECTS.grades` was extended for
 * it — it had been declared for grade-6..grade-8 alone, which would have
 * left the book catalogued and permanently unreachable. See catalog.ts.
 */

import raw from '../data/iqra_curriculum_g4_creative_arts.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G4_CREATIVE_ARTS_BOOK_ID = 'kb-arts-4';
export const G4_CREATIVE_ARTS_CURRICULUM_BOOK_ID = 'book-arts-4';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-4', subject: 'arts', semester: 1 },
  kbBookId: G4_CREATIVE_ARTS_BOOK_ID,
  browserBookId: G4_CREATIVE_ARTS_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG4CreativeArts: NccdCurriculumFile = catalog.curriculum;
export const g4CreativeArtsUnitKbId = catalog.unitKbId;
export const g4CreativeArtsLessonKbId = catalog.lessonKbId;
export const findG4CreativeArtsLessonByKbId = catalog.findLessonByKbId;
export const buildG4CreativeArtsCatalog = catalog.buildCatalog;
export const buildG4CreativeArtsBrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G4CreativeArtsLesson };
