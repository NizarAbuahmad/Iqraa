/**
 * Grade 5 Art, Music and Drama Education (التربية الفنّيّة والموسيقيّة
 * والمسرحيّة) — NCCD student book.
 *
 * Like g1CreativeArts/g2CreativeArts/g3CreativeArts/g4CreativeArts/
 * g8CreativeArts, this one is not split by semester — one title, three units
 * (Art, Music, Drama) covering the whole year, 10 lessons each.
 * `CurriculumIdScope.semester` still requires a number for id-namespacing, so
 * it is set to 1 here as a technical placeholder — it does not mean this is a
 * Semester 1 book, and no Semester 2 counterpart exists or is expected.
 *
 * main_idea_ar is transcribed for all 30 lessons from each lesson's own
 * «الفِكْرَةُ الرَّئيسَة» box, which sits on the lesson's own opener page (same
 * page as g2CreativeArts — the box's text merely extracts *before* the
 * "الدرس N" / "الفِكْرَةُ الرَّئيسَة" label in PyMuPDF's stream order, unlike
 * g1CreativeArts's quirk of the box being on the following page). Unlike
 * g1CreativeArts/g2CreativeArts, this book also prints a real «نَتاجاتُ
 * التَّعَلُّمِ» (learning outcomes) box — with a ممتاز/متوسط/ضعيف self-assessment
 * rubric — at the end of every lesson, so objectives are transcribed for all
 * 30 lessons too, same treatment as g4CreativeArts (transcribed from the
 * start, not deferred). vocabulary is left empty — no bilingual terms box in
 * this book; see the JSON's known_gaps.
 *
 * This subject reaches grade-5 only when `SUBJECTS.grades` is extended for
 * it — it had been declared for grade-1/2/3/4/6/7/8 alone, which would have
 * left the book catalogued and permanently unreachable. See catalog.ts.
 */

import raw from '../data/iqra_curriculum_g5_creative_arts.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G5_CREATIVE_ARTS_BOOK_ID = 'kb-arts-5';
export const G5_CREATIVE_ARTS_CURRICULUM_BOOK_ID = 'book-arts-5';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-5', subject: 'arts', semester: 1 },
  kbBookId: G5_CREATIVE_ARTS_BOOK_ID,
  browserBookId: G5_CREATIVE_ARTS_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG5CreativeArts: NccdCurriculumFile = catalog.curriculum;
export const g5CreativeArtsUnitKbId = catalog.unitKbId;
export const g5CreativeArtsLessonKbId = catalog.lessonKbId;
export const findG5CreativeArtsLessonByKbId = catalog.findLessonByKbId;
export const buildG5CreativeArtsCatalog = catalog.buildCatalog;
export const buildG5CreativeArtsBrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G5CreativeArtsLesson };
