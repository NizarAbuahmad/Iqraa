/**
 * Grade 5 Social Studies (الدراسات الاجتماعية) — Semester 1.
 * Source of truth: data/iqra_curriculum_g5_social_sem1.json
 *
 * Title-only, but for a different reason than the other title-only Grade 5/6
 * books: this IS a normal subject book with a student edition, but its PDF's
 * embedded text layer is corrupted — even PyMuPDF (which reads every other
 * Grade 5 book cleanly) decodes garbled Arabic, because the ToUnicode CMap
 * baked into this specific file is wrong, not because of an extraction-order
 * bug. Unit and lesson titles here were recovered by OCR (Tesseract, `ara`
 * language pack) of the contents pages and each unit's own opener page, not
 * from the text layer. See the JSON's `provenance_note` and `known_gaps` for
 * exactly which titles carry lower confidence (Unit 1 Lesson 1, Unit 4 Lesson
 * 1 in this semester).
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
