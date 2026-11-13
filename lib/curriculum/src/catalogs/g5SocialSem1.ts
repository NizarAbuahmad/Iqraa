/**
 * Grade 5 Social Studies (الدراسات الاجتماعية) — Semester 1.
 * Source of truth: data/iqra_curriculum_g5_social_sem1.json
 *
 * Titles plus one objective per lesson; main ideas and vocabulary are still
 * empty. On 2026-09-16 the PDF's text layer looked garbled even through
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
 * repeat the lesson title. The title-only predicates below are unchanged.
 * See the JSON's `known_gaps`.
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

/** True for every unit in this book — see the header for why it is unconditional. */
export function isG5SocialSem1TitleOnlyUnit(unitKbId: string): boolean {
  return unitKbId.startsWith(unitKbPrefix(SCOPE));
}

/** True for every lesson in this book — see the header for why it is unconditional. */
export function isG5SocialSem1TitleOnlyLesson(kbLessonId: string): boolean {
  return kbLessonId.startsWith(lessonKbPrefix(SCOPE));
}

export const buildG5SocialSem1Catalog = catalog.buildCatalog;
export const buildG5SocialSem1BrowserCatalog = catalog.buildBrowserCatalog;
