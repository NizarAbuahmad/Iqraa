/**
 * Grade 5 Digital Skills (المهارات الرقمية) — Semester 1.
 * Source of truth: data/iqra_curriculum_g5_digital_sem1.json
 *
 * **This is not a subject book; it is a cross-curricular companion**, exactly
 * like g6DigitalSem1.ts. Its content is «لَبِنات» (blocks) that attach to units
 * of OTHER subjects, with block titles copied verbatim from those units'
 * titles — «البيئَةُ», «تَنَوُّعُ الكائِناتِ الحَيَّةِ», «العَناصِرُ
 * وَالمُرَكَّباتُ الكيميائِيَّةُ», «الغِذاءُ وَالصِّحَّةُ», «أَجْهِزَةُ جِسْمِ
 * الإِنْسانِ» and «الحَرَكَةُ وَالطّاقَةُ» are all Science unit titles. Six
 * blocks are carried as six units and four «مَشاريعُ تَعَلُّمٍ» (learning
 * projects) as four more, in the order the activity book's contents page
 * prints them (pages 4-6 of the 147-page PDF).
 *
 * Mostly title-only: the structure comes from the activity book's table of
 * contents. `vocabulary` (since 2026-11-13) is filled for one lesson only,
 * u2_l4: four terms from the book's single terms box, «مصطلحات يجب أن
 * أعرفها» (pp. 33-34). Its fifth entry, Google Slides, is left out because the
 * extraction garbles its Arabic name. No other task prints a terms box.
 * `objectives` (since 2026-11-13) holds 14 statements in 11 of
 * the 26 lessons, read from the activity book's text: items of each block's
 * «نتاجات التعلم» list (pp. 7, 27, 43, 87, 99, 109) given to a task only where
 * they clearly describe that one task, plus block 4's own task aims (pp. 88,
 * 90). Everything left out, and why, is in the JSON's `meta.known_gaps`.
 * The four learning projects print no outcomes, so they stay empty.
 * `main_idea_ar` (since 2026-11-13) is filled for 7 of the 26 lessons, copied
 * from the book: each learning project's box on what it revolves around
 * («الفكرة / المشكلة التي يدور حولها المشروع», pp. 59, 74, 123, 137) and
 * block 4's own task descriptions (pp. 88, 90). No other task prints one.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g5_digital_sem1.json' with { type: 'json' };
import { lessonKbPrefix, unitKbPrefix, type CurriculumIdScope } from '../curriculumIds.ts';
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G5_DIGITAL_S1_BOOK_ID = 'kb-digital-5-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G5_DIGITAL_S1_CURRICULUM_BOOK_ID = 'book-digital-5-s1';

const SCOPE: CurriculumIdScope = { gradeId: 'grade-5', subject: 'digital', semester: 1 };

const catalog = makeNccdCatalog({
  scope: SCOPE,
  kbBookId: G5_DIGITAL_S1_BOOK_ID,
  browserBookId: G5_DIGITAL_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG5DigitalSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g5-digital-s1-nccd-u1). */
export const g5DigitalSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g5-digital-s1-nccd-u1_l1). */
export const g5DigitalSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG5DigitalSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

/** A lesson the catalog holds nothing for beyond its title. */
const isEmptyLesson = (l: NccdLesson) =>
  !l.main_idea_ar && !(l.objectives ?? []).length && !(l.vocabulary ?? []).length;

/**
 * A unit whose lessons are all titles only — decided by the content, not the
 * id. Until 2026-11-13 every id in this book was flagged; 15 of its 26 tasks
 * and projects now carry objectives or a main idea from the activity book.
 */
export function isG5DigitalSem1TitleOnlyUnit(unitKbId: string): boolean {
  if (!unitKbId.startsWith(unitKbPrefix(SCOPE))) return false;
  const unit = catalog.curriculum.units.find(u => catalog.unitKbId(u.id) === unitKbId);
  return !!unit && unit.lessons.every(isEmptyLesson);
}

/** A lesson with nothing beyond its title — see `isG5DigitalSem1TitleOnlyUnit`. */
export function isG5DigitalSem1TitleOnlyLesson(kbLessonId: string): boolean {
  if (!kbLessonId.startsWith(lessonKbPrefix(SCOPE))) return false;
  const lesson = catalog.findLessonByKbId(kbLessonId);
  return !!lesson && isEmptyLesson(lesson);
}

export const buildG5DigitalSem1Catalog = catalog.buildCatalog;
export const buildG5DigitalSem1BrowserCatalog = catalog.buildBrowserCatalog;
