/**
 * Grade 4 Digital Skills (المهارات الرقمية) — Semester 2.
 * Source of truth: data/iqra_curriculum_g4_digital_sem2.json
 *
 * The second half of the same activity book as g4DigitalSem1.ts — read that
 * file's header for what the book is. The book covers the whole year («ثلاث
 * لبنات تعلّم لكل فصل دراسي», p. 3): blocks 4-6 («الضَّوْءُ», «الأَنْماطُ
 * وَالمُعادَلاتُ», «الكَهْرَباءُ») attach to semester-2 science and maths units
 * (pp. 82, 92, 102), and the two learning projects after them start their
 * numbering again. Units keep the book's numbers, 6-10, as Grade 4 science
 * and maths semester 2 do. Split out of the semester-1 file on 2026-11-13;
 * these lessons were `kbl-g4-digital-s1-nccd-u6…u10_*` before that.
 *
 * Title-only, like semester 1.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g4_digital_sem2.json' with { type: 'json' };
import { lessonKbPrefix, unitKbPrefix, type CurriculumIdScope } from '../curriculumIds.ts';
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G4_DIGITAL_S2_BOOK_ID = 'kb-digital-4-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G4_DIGITAL_S2_CURRICULUM_BOOK_ID = 'book-digital-4-s2';

const SCOPE: CurriculumIdScope = { gradeId: 'grade-4', subject: 'digital', semester: 2 };

const catalog = makeNccdCatalog({
  scope: SCOPE,
  kbBookId: G4_DIGITAL_S2_BOOK_ID,
  browserBookId: G4_DIGITAL_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG4DigitalSem2: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u6 → kbu-g4-digital-s2-nccd-u6). */
export const g4DigitalSem2UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g4-digital-s2-nccd-u6_l1). */
export const g4DigitalSem2LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG4DigitalSem2LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

/** True for every unit in this book — see the header for why it is unconditional. */
export function isG4DigitalSem2TitleOnlyUnit(unitKbId: string): boolean {
  return unitKbId.startsWith(unitKbPrefix(SCOPE));
}

/** True for every lesson in this book — see the header for why it is unconditional. */
export function isG4DigitalSem2TitleOnlyLesson(kbLessonId: string): boolean {
  return kbLessonId.startsWith(lessonKbPrefix(SCOPE));
}

export const buildG4DigitalSem2Catalog = catalog.buildCatalog;
export const buildG4DigitalSem2BrowserCatalog = catalog.buildBrowserCatalog;
