/**
 * Grade 10 Art, Music and Drama Education (التربية الفنّيّة والموسيقيّة
 * والمسرحيّة) — NCCD student book. Oldest grade this subject reaches in this
 * repo so far, and its book is noticeably more advanced than the younger
 * grades': 3 units (Art/Music/Drama) but only 23 lessons total (7 + 8 + 8),
 * not the 10/10/10 = 30 pattern every other grade's version of this subject
 * follows. Like every other grade, this one is not split by semester — one
 * title, no «الفصل الأول/الثاني» on the cover, whole year in one book.
 * `CurriculumIdScope.semester` still requires a number for id-namespacing
 * (`kbu-arts-s1-nccd-u1`, etc.), so it is set to 1 here as a technical
 * placeholder — it does not mean this is a Semester 1 book, and no Semester 2
 * counterpart exists or is expected.
 *
 * objectives for all 23 lessons are transcribed from each lesson's own
 * closing «أُقيِّمُ تعلُّمي» performance-criteria box — NOT the unit-level
 * «النتاجاتُ الخاصّةُ بالوحدةِ» numbered list every younger grade's catalog
 * uses, because that list was verified against the PDF to map cleanly 1:1
 * onto lessons only in the Art unit; the Music unit's list has 9 outcomes for
 * 8 lessons (one matches no lesson), and the Drama unit's has two outcomes
 * that both belong to lesson 1 alone. The per-lesson box exists on every one
 * of the 23 lessons and is richer besides — see the JSON's known_gaps for the
 * verification detail. This does for Grade 10 from the start what
 * g4CreativeArts.ts had to fix after the fact.
 */

import raw from '../data/iqra_curriculum_g10_creative_arts.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G10_CREATIVE_ARTS_BOOK_ID = 'kb-arts-10';
export const G10_CREATIVE_ARTS_CURRICULUM_BOOK_ID = 'book-arts-10';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-10', subject: 'arts', semester: 1 },
  kbBookId: G10_CREATIVE_ARTS_BOOK_ID,
  browserBookId: G10_CREATIVE_ARTS_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG10CreativeArts: NccdCurriculumFile = catalog.curriculum;
export const g10CreativeArtsUnitKbId = catalog.unitKbId;
export const g10CreativeArtsLessonKbId = catalog.lessonKbId;
export const findG10CreativeArtsLessonByKbId = catalog.findLessonByKbId;
export const buildG10CreativeArtsCatalog = catalog.buildCatalog;
export const buildG10CreativeArtsBrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G10CreativeArtsLesson };
