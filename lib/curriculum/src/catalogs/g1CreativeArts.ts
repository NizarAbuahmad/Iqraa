/**
 * Grade 1 Art, Music and Drama Education (التربية الفنّيّة والموسيقيّة
 * والمسرحيّة) — NCCD student book.
 *
 * Like g3CreativeArts/g4CreativeArts/g8CreativeArts, this one is not split
 * by semester — one title, three units (Art, Music, Drama) covering the
 * whole year, 10 lessons each. `CurriculumIdScope.semester` still requires
 * a number for id-namespacing, so it is set to 1 here as a technical
 * placeholder — it does not mean this is a Semester 1 book, and no
 * Semester 2 counterpart exists or is expected.
 *
 * main_idea_ar is transcribed for all 30 lessons from each lesson's own
 * «الفِكْرَةُ الرَّئيسَة» box (or from the immediately-following «أَتَعَلَّم»
 * text where the box's own position on the page varies, same quirk as
 * g3CreativeArts). objectives/vocabulary are left empty; see the JSON's
 * known_gaps.
 *
 * This subject reaches grade-1 only when `SUBJECTS.grades` is extended for
 * it — it had been declared for grade-3/4/6/7/8 alone, which would have
 * left the book catalogued and permanently unreachable. See catalog.ts.
 */

import raw from '../data/iqra_curriculum_g1_creative_arts.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G1_CREATIVE_ARTS_BOOK_ID = 'kb-arts-1';
export const G1_CREATIVE_ARTS_CURRICULUM_BOOK_ID = 'book-arts-1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-1', subject: 'arts', semester: 1 },
  kbBookId: G1_CREATIVE_ARTS_BOOK_ID,
  browserBookId: G1_CREATIVE_ARTS_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG1CreativeArts: NccdCurriculumFile = catalog.curriculum;
export const g1CreativeArtsUnitKbId = catalog.unitKbId;
export const g1CreativeArtsLessonKbId = catalog.lessonKbId;
export const findG1CreativeArtsLessonByKbId = catalog.findLessonByKbId;
export const buildG1CreativeArtsCatalog = catalog.buildCatalog;
export const buildG1CreativeArtsBrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G1CreativeArtsLesson };
