/**
 * Grade 6 Digital Skills (المهارات الرقمية) — Semester 1.
 * Source of truth: data/iqra_curriculum_g6_digital_sem1.json
 *
 * **This is not a subject book; it is a cross-curricular companion.** Its
 * content is «لَبِنات» — blocks that attach to units of OTHER subjects — and the
 * block titles are those units' titles verbatim: «مِنَ الخَلِيَّةِ إلى الجِسْمِ»,
 * «المادَّةُ», «المَخاليطُ وَطَرائِقُ فَصْلِها» and «الصَّوْتُ» from the science
 * books, «التَّحْويلاتُ وَالإِنْشاءاتُ الهَنْدَسِيَّةُ» and «الهَنْدَسَةُ
 * وَالقِياسُ» from maths. Six blocks are carried as six units and four «مشاريع
 * تعلُّم» as four more, in the order the contents page prints them.
 *
 * Two consequences worth knowing before reading anything into the ids:
 *
 *  • A unit title here DUPLICATES a science or maths unit title. That is the
 *    book, not a mistake. The KB ids differ by subject
 *    (`kbu-g6-digital-s1-nccd-u1` vs `kbu-g6-science-s1-nccd-u1`), so nothing
 *    collides — but a title-based lookup across subjects would conflate them,
 *    which is one more reason the repo carries lesson IDs rather than titles.
 *  • The book is labelled Semester 1, yet blocks 4 and 6 attach to «المَخاليطُ»
 *    and «الصَّوْتُ» — science Semester 2, units 6 and 7. Its own semester split
 *    does not match the subjects it plugs into. `semester: 1` follows the cover,
 *    not the content.
 *
 * Title-only, like the rest of the Grade 6 humanities set. There is no student
 * book and no Semester 2 book at all; the activity book and teacher guide are
 * everything that exists, which makes this the narrowest subject in the grade.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g6_digital_sem1.json' with { type: 'json' };
import { lessonKbPrefix, unitKbPrefix, type CurriculumIdScope } from '../curriculumIds.ts';
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G6_DIGITAL_S1_BOOK_ID = 'kb-digital-6-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G6_DIGITAL_S1_CURRICULUM_BOOK_ID = 'book-digital-6-s1';

const SCOPE: CurriculumIdScope = { gradeId: 'grade-6', subject: 'digital', semester: 1 };

const catalog = makeNccdCatalog({
  scope: SCOPE,
  kbBookId: G6_DIGITAL_S1_BOOK_ID,
  browserBookId: G6_DIGITAL_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG6DigitalSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g6-digital-s1-nccd-u1). */
export const g6DigitalSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g6-digital-s1-nccd-u1_l1). */
export const g6DigitalSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG6DigitalSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

/** True for every unit in this book — see the header for why it is unconditional. */
export function isG6DigitalSem1TitleOnlyUnit(unitKbId: string): boolean {
  return unitKbId.startsWith(unitKbPrefix(SCOPE));
}

/** True for every lesson in this book — see the header for why it is unconditional. */
export function isG6DigitalSem1TitleOnlyLesson(kbLessonId: string): boolean {
  return kbLessonId.startsWith(lessonKbPrefix(SCOPE));
}

export const buildG6DigitalSem1Catalog = catalog.buildCatalog;
export const buildG6DigitalSem1BrowserCatalog = catalog.buildBrowserCatalog;
