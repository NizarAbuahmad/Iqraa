/**
 * Grade 6 English — Semester 1 (Jordan Team Together, Pupil's Book).
 * Source of truth: data/iqra_curriculum_g6_english_sem1.json
 *
 * **Title-only, and here that is a rights decision rather than an effort one.**
 * The pupil's book, the activity book AND the teacher's book are all
 * © Pearson Education Limited and York Press, so all six sources are registered
 * `authority: 'third-party'` and none of their text is ever quoted. What is
 * carried is structure only: unit names as the contents page prints them, and
 * the nine-lesson sequence the Teacher's Book's "Unit walkthrough" states.
 *
 * `objectives` and `vocabulary` are deliberately empty. The Teacher's Book does
 * print per-unit objectives, vocabulary and grammar in its "Scope and sequence"
 * table — that is exactly the copyrighted material this classification exists
 * to keep out of the catalogue.
 *
 * **These lessons are not groundable.** Retrievable passages are `quotableOnly`
 * — nccd sources — and every source here is third-party. The units and lessons
 * are for browsing and picking; nothing will generate from the book's text.
 *
 * The nine lessons are not extrapolated from one unit: the walkthrough (pp. 8-9)
 * presents the template as the shape of every unit, with lessons 4 and 7 named
 * as the Activity Book companions to 3 and 6.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g6_english_sem1.json' with { type: 'json' };
import { lessonKbPrefix, unitKbPrefix, type CurriculumIdScope } from '../curriculumIds.ts';
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G6_ENGLISH_S1_BOOK_ID = 'kb-english-6-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G6_ENGLISH_S1_CURRICULUM_BOOK_ID = 'book-english-6-s1';

const SCOPE: CurriculumIdScope = { gradeId: 'grade-6', subject: 'eng', semester: 1 };

const catalog = makeNccdCatalog({
  scope: SCOPE,
  kbBookId: G6_ENGLISH_S1_BOOK_ID,
  browserBookId: G6_ENGLISH_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG6EnglishSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g6-eng-s1-nccd-u1). */
export const g6EnglishSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g6-eng-s1-nccd-u1_l1). */
export const g6EnglishSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG6EnglishSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

/** True for every unit in this book — see the header for why it is unconditional. */
export function isG6EnglishSem1TitleOnlyUnit(unitKbId: string): boolean {
  return unitKbId.startsWith(unitKbPrefix(SCOPE));
}

/** True for every lesson in this book — see the header for why it is unconditional. */
export function isG6EnglishSem1TitleOnlyLesson(kbLessonId: string): boolean {
  return kbLessonId.startsWith(lessonKbPrefix(SCOPE));
}

export const buildG6EnglishSem1Catalog = catalog.buildCatalog;
export const buildG6EnglishSem1BrowserCatalog = catalog.buildBrowserCatalog;
