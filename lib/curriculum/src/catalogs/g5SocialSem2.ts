/**
 * Grade 5 Social Studies (الدراسات الاجتماعية) — Semester 2.
 * Source of truth: data/iqra_curriculum_g5_social_sem2.json
 *
 * Titles plus one objective per lesson, same history as g5SocialSem1 (see
 * that file's header): the text layer was taken for a corrupted ToUnicode
 * CMap on 2026-09-16, so unit and lesson titles were recovered by OCR of the
 * contents pages and unit opener pages; on 2026-11-13 it turned out to be
 * visual-order text that reads cleanly once each line is reversed. Units are
 * numbered 5-8, continuing Semester 1's 1-4, matching the book's own cover
 * and contents page. Re-checked 2026-11-13 against the contents pages in
 * data/extracted/g5-social-s2-student-book.json: Unit 7 has four lessons —
 * «دول المغرب العربي» was appended as u7_l4 — and Unit 8 Lesson 1 is
 * «الثقافة». The same day `objectives` were filled from each unit opener's
 * «ماذا سأتعلم؟» box (pp. 7, 27, 49, 81; one item per lesson, in lesson
 * order — four for Unit 7). The same day `main_idea_ar` was filled from each
 * lesson opener's «الفكرة الرئيسة» box and `vocabulary` from its
 * «المصطلحات» box (pp. 8, 12, 18, 28, 32, 38, 50, 59, 63, 71, 82, 87), as
 * printed, without harakat; each term's `en` is the English the book prints
 * beside it (29 terms; «دول المغرب العربي», p. 71, has none, so `en` is "").
 * Each transcription was checked letter-for-letter against its box's lines.
 * The title-only predicates below now follow the content, so no lesson wears
 * the «عنوان الدرس فقط» badge. See the JSON's `known_gaps`.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g5_social_sem2.json' with { type: 'json' };
import { lessonKbPrefix, unitKbPrefix, type CurriculumIdScope } from '../curriculumIds.ts';
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G5_SOCIAL_S2_BOOK_ID = 'kb-social-5-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G5_SOCIAL_S2_CURRICULUM_BOOK_ID = 'book-social-5-s2';

const SCOPE: CurriculumIdScope = { gradeId: 'grade-5', subject: 'social', semester: 2 };

const catalog = makeNccdCatalog({
  scope: SCOPE,
  kbBookId: G5_SOCIAL_S2_BOOK_ID,
  browserBookId: G5_SOCIAL_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG5SocialSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u5 → kbu-g5-social-s2-nccd-u5). */
export const g5SocialSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u5_l1 → kbl-g5-social-s2-nccd-u5_l1). */
export const g5SocialSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG5SocialSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

/** A lesson the catalog holds nothing for beyond its title. */
const isEmptyLesson = (l: NccdLesson) =>
  !l.main_idea_ar && !(l.objectives ?? []).length && !(l.vocabulary ?? []).length;

/**
 * A unit whose lessons are all titles only — decided by the content, not the
 * id. Until 2026-11-13 every id in this book was flagged, because its text was
 * thought unreadable; it reads once each line is reversed, and the lessons now
 * carry the book's main idea, objectives and terms.
 */
export function isG5SocialSem2TitleOnlyUnit(unitKbId: string): boolean {
  if (!unitKbId.startsWith(unitKbPrefix(SCOPE))) return false;
  const unit = catalog.curriculum.units.find(u => catalog.unitKbId(u.id) === unitKbId);
  return !!unit && unit.lessons.every(isEmptyLesson);
}

/** A lesson with nothing beyond its title — see `isG5SocialSem2TitleOnlyUnit`. */
export function isG5SocialSem2TitleOnlyLesson(kbLessonId: string): boolean {
  if (!kbLessonId.startsWith(lessonKbPrefix(SCOPE))) return false;
  const lesson = catalog.findLessonByKbId(kbLessonId);
  return !!lesson && isEmptyLesson(lesson);
}

export const buildG5SocialSem2Catalog = catalog.buildCatalog;
export const buildG5SocialSem2BrowserCatalog = catalog.buildBrowserCatalog;
