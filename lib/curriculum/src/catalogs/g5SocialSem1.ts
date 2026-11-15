/**
 * Grade 5 Social Studies (الدراسات الاجتماعية) — Semester 1.
 * Source of truth: data/iqra_curriculum_g5_social_sem1.json
 *
 * Titles, one objective, a main idea and the book's terms per lesson. On
 * 2026-09-16 the PDF's text layer looked garbled even through
 * PyMuPDF (which reads every other Grade 5 book cleanly), and was put down to
 * a broken ToUnicode CMap, so unit and lesson titles were recovered by OCR
 * (Tesseract, `ara` language pack) of the contents pages and each unit's
 * opener page. Re-checked 2026-11-13: the text is not corrupted — the
 * extracted text in data/extracted/g5-social-s1-student-book.json is in
 * visual order (each line's characters reversed, some lam-alef pairs
 * swapped) and reads cleanly once a line is reversed. Three OCR-era titles
 * were corrected from it (Unit 1 Lesson 1, Unit 4 Lessons 1 and 3), and
 * `objectives` were filled from each unit opener's «ماذا سأتعلم؟» box (pp. 7,
 * 29, 49, 75): the book prints no per-lesson outcomes box, and that box has
 * exactly one item per lesson, in lesson order, each matching its lesson's
 * topic. They are topic phrases, not behavioural outcomes, and some nearly
 * repeat the lesson title. The same day `main_idea_ar` was filled from each
 * lesson opener's «الفكرة الرئيسة» box and `vocabulary` from its
 * «المصطلحات» box (pp. 8, 15, 21, 30, 35, 39, 42, 50, 58, 64, 76, 81, 87),
 * as printed, without harakat; each term's `en` is the English the book
 * prints beside it (31 terms, all with English). Each transcription was
 * checked letter-for-letter against its box's lines. The title-only
 * predicates below now follow the content, so no lesson wears the
 * «عنوان الدرس فقط» badge. See the JSON's `known_gaps`.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g5_social_sem1.json' with { type: 'json' };
import { lessonKbPrefix, unitKbPrefix, type CurriculumIdScope } from '../curriculumIds.ts';
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G5_SOCIAL_S1_BOOK_ID = 'kb-social-5-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G5_SOCIAL_S1_CURRICULUM_BOOK_ID = 'book-social-5-s1';

const SCOPE: CurriculumIdScope = { gradeId: 'grade-5', subject: 'social', semester: 1 };

const catalog = makeNccdCatalog({
  scope: SCOPE,
  kbBookId: G5_SOCIAL_S1_BOOK_ID,
  browserBookId: G5_SOCIAL_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG5SocialSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g5-social-s1-nccd-u1). */
export const g5SocialSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g5-social-s1-nccd-u1_l1). */
export const g5SocialSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG5SocialSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
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
export function isG5SocialSem1TitleOnlyUnit(unitKbId: string): boolean {
  if (!unitKbId.startsWith(unitKbPrefix(SCOPE))) return false;
  const unit = catalog.curriculum.units.find(u => catalog.unitKbId(u.id) === unitKbId);
  return !!unit && unit.lessons.every(isEmptyLesson);
}

/** A lesson with nothing beyond its title — see `isG5SocialSem1TitleOnlyUnit`. */
export function isG5SocialSem1TitleOnlyLesson(kbLessonId: string): boolean {
  if (!kbLessonId.startsWith(lessonKbPrefix(SCOPE))) return false;
  const lesson = catalog.findLessonByKbId(kbLessonId);
  return !!lesson && isEmptyLesson(lesson);
}

export const buildG5SocialSem1Catalog = catalog.buildCatalog;
export const buildG5SocialSem1BrowserCatalog = catalog.buildBrowserCatalog;
