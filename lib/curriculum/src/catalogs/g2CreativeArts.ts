/**
 * Grade 2 Art, Music and Drama Education (التربية الفنّيّة والموسيقيّة
 * والمسرحيّة) — NCCD student book.
 *
 * Like g1CreativeArts/g3CreativeArts/g4CreativeArts/g8CreativeArts, this one
 * is not split by semester — one title, three units (Art, Music, Drama)
 * covering the whole year, 10 lessons each. `CurriculumIdScope.semester`
 * still requires a number for id-namespacing, so it is set to 1 here as a
 * technical placeholder — it does not mean this is a Semester 1 book, and no
 * Semester 2 counterpart exists or is expected.
 *
 * main_idea_ar is transcribed for 29 of the 30 lessons from each lesson's own
 * «الفِكْرَةُ الرَّئيسَة» box, which — unlike g1CreativeArts's quirk — sits
 * directly on the lesson's own opener page every time here, never on the
 * following page. u3_l6's box is a genuine printing defect (verbatim repeat
 * of u3_l5's text, verified against the PDF directly) — left empty rather
 * than guessed, same as g3SocialSem1's u2_l1. objectives/vocabulary are
 * empty throughout; see the JSON's known_gaps.
 *
 * This subject reaches grade-2 only when `SUBJECTS.grades` is extended for
 * it — it had been declared for grade-1/3/4/6/7/8 alone, which would have
 * left the book catalogued and permanently unreachable. See catalog.ts.
 */

import raw from '../data/iqra_curriculum_g2_creative_arts.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G2_CREATIVE_ARTS_BOOK_ID = 'kb-arts-2';
export const G2_CREATIVE_ARTS_CURRICULUM_BOOK_ID = 'book-arts-2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-2', subject: 'arts', semester: 1 },
  kbBookId: G2_CREATIVE_ARTS_BOOK_ID,
  browserBookId: G2_CREATIVE_ARTS_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG2CreativeArts: NccdCurriculumFile = catalog.curriculum;
export const g2CreativeArtsUnitKbId = catalog.unitKbId;
export const g2CreativeArtsLessonKbId = catalog.lessonKbId;
export const findG2CreativeArtsLessonByKbId = catalog.findLessonByKbId;
export const buildG2CreativeArtsCatalog = catalog.buildCatalog;
export const buildG2CreativeArtsBrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G2CreativeArtsLesson };
