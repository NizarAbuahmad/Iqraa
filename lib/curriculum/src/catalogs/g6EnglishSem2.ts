/**
 * Grade 6 English — Semester 2 (Jordan Team Together, Pupil's Book).
 * Source of truth: data/iqra_curriculum_g6_english_sem2.json
 *
 * **Title-only, and here that is a rights decision rather than an effort one.**
 * The pupil's book, the activity book AND the teacher's book are all
 * © Pearson Education Limited and York Press, so all six sources are registered
 * `authority: 'third-party'` and none of their text is ever quoted. What is
 * carried is structure only: unit names as the contents page prints them, and
 * the twelve-lesson sequence the Teacher's Book lists (p. 9: "There are 12
 * lessons in each main unit").
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
 * Twelve lessons a unit, not nine (corrected 2026-11-13). The walkthrough on
 * pp. 8-9 shows lessons 1-9; p. 9 counts twelve and p. 12 shows lessons 10-12
 * (Literacy, Writing, and the Activity Book lesson for Writing). Lessons 4, 7
 * and 12 are the Activity Book companions to 3, 6 and 11. Lessons 10-12 were
 * appended, so no existing lesson id moved.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g6_english_sem2.json' with { type: 'json' };
import { lessonKbPrefix, unitKbPrefix, type CurriculumIdScope } from '../curriculumIds.ts';
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G6_ENGLISH_S2_BOOK_ID = 'kb-english-6-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G6_ENGLISH_S2_CURRICULUM_BOOK_ID = 'book-english-6-s2';

const SCOPE: CurriculumIdScope = { gradeId: 'grade-6', subject: 'eng', semester: 2 };

const catalog = makeNccdCatalog({
  scope: SCOPE,
  kbBookId: G6_ENGLISH_S2_BOOK_ID,
  browserBookId: G6_ENGLISH_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG6EnglishSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u5 → kbu-g6-eng-s2-nccd-u5). */
export const g6EnglishSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u5_l1 → kbl-g6-eng-s2-nccd-u5_l1). */
export const g6EnglishSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG6EnglishSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

/** True for every unit in this book — see the header for why it is unconditional. */
export function isG6EnglishSem2TitleOnlyUnit(unitKbId: string): boolean {
  return unitKbId.startsWith(unitKbPrefix(SCOPE));
}

/** True for every lesson in this book — see the header for why it is unconditional. */
export function isG6EnglishSem2TitleOnlyLesson(kbLessonId: string): boolean {
  return kbLessonId.startsWith(lessonKbPrefix(SCOPE));
}

export const buildG6EnglishSem2Catalog = catalog.buildCatalog;
export const buildG6EnglishSem2BrowserCatalog = catalog.buildBrowserCatalog;
