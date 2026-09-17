/**
 * Grade 4 Digital Skills (المهارات الرقمية) — Semester 1.
 * Source of truth: data/iqra_curriculum_g4_digital_sem1.json
 *
 * **This is not a subject book; it is a cross-curricular companion**, exactly
 * like g5DigitalSem1.ts. Its content is «لَبِنات» (blocks) that attach to
 * units of Science and Math for this grade, with block titles copied
 * verbatim from the activity book's own table of contents — «تَصْنيفُ
 * الكائِناتِ الحَيَّةِ», «الضَّرْبُ وَالقِسْمَةُ», «المادَّةُ», «الضَّوْءُ»,
 * «الأَنْماطُ وَالمُعادَلاتُ» and «الكَهْرَباءُ». Six blocks are carried as
 * six units and four «مَشاريعُ تَعَلُّمٍ» (learning projects) as four more,
 * in the order the activity book's contents page prints them (pages 4-6 of
 * the 149-page PDF).
 *
 * Title-only: the activity book's table of contents is everything that was
 * read. There is no per-lesson content — `main_idea_ar`/`objectives`/
 * `vocabulary` are empty throughout, same as g5DigitalSem1.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g4_digital_sem1.json' with { type: 'json' };
import { lessonKbPrefix, unitKbPrefix, type CurriculumIdScope } from '../curriculumIds.ts';
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G4_DIGITAL_S1_BOOK_ID = 'kb-digital-4-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G4_DIGITAL_S1_CURRICULUM_BOOK_ID = 'book-digital-4-s1';

const SCOPE: CurriculumIdScope = { gradeId: 'grade-4', subject: 'digital', semester: 1 };

const catalog = makeNccdCatalog({
  scope: SCOPE,
  kbBookId: G4_DIGITAL_S1_BOOK_ID,
  browserBookId: G4_DIGITAL_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG4DigitalSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g4-digital-s1-nccd-u1). */
export const g4DigitalSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g4-digital-s1-nccd-u1_l1). */
export const g4DigitalSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG4DigitalSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

/** True for every unit in this book — see the header for why it is unconditional. */
export function isG4DigitalSem1TitleOnlyUnit(unitKbId: string): boolean {
  return unitKbId.startsWith(unitKbPrefix(SCOPE));
}

/** True for every lesson in this book — see the header for why it is unconditional. */
export function isG4DigitalSem1TitleOnlyLesson(kbLessonId: string): boolean {
  return kbLessonId.startsWith(lessonKbPrefix(SCOPE));
}

export const buildG4DigitalSem1Catalog = catalog.buildCatalog;
export const buildG4DigitalSem1BrowserCatalog = catalog.buildBrowserCatalog;
