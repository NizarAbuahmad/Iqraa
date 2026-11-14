/**
 * Grade 5 Arabic (اللغة العربية) — Semester 2.
 * Source of truth: data/iqra_curriculum_g5_arabic_sem2.json
 *
 * Title-only for the same reason as g5ArabicSem1 — see that file's header.
 * Units are numbered 6-10, continuing Semester 1's 1-5, matching the book's
 * own cover and contents page.
 *
 * `objectives` is filled (2026-11-13) the same way as Semester 1, from the
 * unit-competency pages (pp. 7, 33, 59, 85, 111): 65 of the 70 items,
 * unvowelled, because this book's pdf-parse text is far more scrambled
 * (letters reversed within segments, marks detached, ي read as U+FFFD on
 * pp. 33/59, medial ه dropped on p. 111). Each section's statements were
 * matched letter for letter against that section of the page. Left out, and
 * why, in the JSON's known_gaps: u7_l3's third item (a repeated phrase whose
 * place cannot be fixed), the spelling item of u8_l4 and u9_l4 (the page
 * names a different hamza topic than the lesson's own page), and both items
 * of u8_l5 (list punctuation not recoverable) — so u8_l5 has none.
 *
 * `vocabulary` is empty except u8_l4 (2026-11-13): the only place either
 * book prints words with their meanings is the "word: meaning" margin gloss
 * of Shawqi's poem on p. 76 of that writing lesson (pp. 73-78). Its six
 * words are taken unvowelled, in the gloss's order, with `en: ""`; the
 * search and the rest of the reasoning are in the JSON's known_gaps.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g5_arabic_sem2.json' with { type: 'json' };
import { lessonKbPrefix, unitKbPrefix, type CurriculumIdScope } from '../curriculumIds.ts';
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G5_ARABIC_S2_BOOK_ID = 'kb-arabic-5-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G5_ARABIC_S2_CURRICULUM_BOOK_ID = 'book-arabic-5-s2';

const SCOPE: CurriculumIdScope = { gradeId: 'grade-5', subject: 'arabic', semester: 2 };

const catalog = makeNccdCatalog({
  scope: SCOPE,
  kbBookId: G5_ARABIC_S2_BOOK_ID,
  browserBookId: G5_ARABIC_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG5ArabicSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u6 → kbu-g5-arabic-s2-nccd-u6). */
export const g5ArabicSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u6_l1 → kbl-g5-arabic-s2-nccd-u6_l1). */
export const g5ArabicSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG5ArabicSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

/** A lesson the catalog holds nothing for beyond its title. */
const isEmptyLesson = (l: NccdLesson) =>
  !l.main_idea_ar && !(l.objectives ?? []).length && !(l.vocabulary ?? []).length;

/**
 * A unit whose lessons are all titles only — decided by the content, not the
 * id. Until 2026-11-13 every id in this book was flagged; the lessons now carry
 * their unit competency page's objectives, so the «عنوان الدرس فقط» badge only
 * marks a lesson that still has nothing (main ideas stay empty on purpose: the
 * book prints no main-idea box).
 */
export function isG5ArabicSem2TitleOnlyUnit(unitKbId: string): boolean {
  if (!unitKbId.startsWith(unitKbPrefix(SCOPE))) return false;
  const unit = catalog.curriculum.units.find(u => catalog.unitKbId(u.id) === unitKbId);
  return !!unit && unit.lessons.every(isEmptyLesson);
}

/** A lesson with nothing beyond its title — see `isG5ArabicSem2TitleOnlyUnit`. */
export function isG5ArabicSem2TitleOnlyLesson(kbLessonId: string): boolean {
  if (!kbLessonId.startsWith(lessonKbPrefix(SCOPE))) return false;
  const lesson = catalog.findLessonByKbId(kbLessonId);
  return !!lesson && isEmptyLesson(lesson);
}

export const buildG5ArabicSem2Catalog = catalog.buildCatalog;
export const buildG5ArabicSem2BrowserCatalog = catalog.buildBrowserCatalog;
