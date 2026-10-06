/**
 * Grade 9 Art, Music and Drama Education (التربية الفنّيّة والموسيقيّة
 * والمسرحيّة) — NCCD student book, 120 pages, 2026 reprint of the 2025
 * trial edition. Three units (Art/Music/Drama) of 7 + 10 + 8 = 25 lessons —
 * the Grade 10 book's shape (see g10CreativeArts.ts), not the 10/10/10 = 30
 * pattern of Grades 1–5, 7 and 8.
 *
 * nccd.gov.jo lists it under «الفصل الأول», but the book itself prints no
 * semester anywhere — one title, whole year, like every other grade's version
 * of this subject. `CurriculumIdScope.semester` still requires a number for
 * id-namespacing (`kbu-g9-arts-s1-nccd-u1`, etc.), so it is set to 1 here as
 * a technical placeholder, as in the other creative-arts catalogs; no
 * Semester 2 counterpart is known.
 *
 * objectives for all 25 lessons are transcribed from each lesson's own
 * closing «أُقيِّمُ تعلُّمي» performance-criteria box, as g10CreativeArts.ts
 * does. Here the unit-level «النتاجاتُ الخاصّةُ بالوحدةِ» lists (7, 10, 8)
 * do happen to match the lessons one to one, but the per-lesson box is more
 * specific and exists on every lesson, so it is the source. vocabulary is
 * empty: no bilingual terms box in this book; see the JSON's known_gaps.
 *
 * This subject reaches grade-9 only because `SUBJECTS.grades` was extended
 * for it — see catalog.ts.
 */

import raw from '../data/iqra_curriculum_g9_creative_arts.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G9_CREATIVE_ARTS_BOOK_ID = 'kb-arts-9';
export const G9_CREATIVE_ARTS_CURRICULUM_BOOK_ID = 'book-arts-9';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-9', subject: 'arts', semester: 1 },
  kbBookId: G9_CREATIVE_ARTS_BOOK_ID,
  browserBookId: G9_CREATIVE_ARTS_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG9CreativeArts: NccdCurriculumFile = catalog.curriculum;
export const g9CreativeArtsUnitKbId = catalog.unitKbId;
export const g9CreativeArtsLessonKbId = catalog.lessonKbId;
export const findG9CreativeArtsLessonByKbId = catalog.findLessonByKbId;
export const buildG9CreativeArtsCatalog = catalog.buildCatalog;
export const buildG9CreativeArtsBrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G9CreativeArtsLesson };
