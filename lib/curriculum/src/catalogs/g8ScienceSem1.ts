/**
 * Grade 8 Science (العلوم) — Semester 1 (NCCD student book + teacher guide).
 * Source of truth: data/iqra_curriculum_g8_science_sem1.json
 *
 * Built through `makeNccdCatalog` — see `nccdCatalog.ts` — because this book
 * prints exactly the shape that factory assumes: «الفكرةُ الرئيسةُ»,
 * «نتاجاتُ التعلُّمِ» and a bilingual «المفاهيمُ والمصطلحاتُ» on every lesson
 * opener, plus a «الفكرةُ العامةُ» on every unit opener.
 *
 * This is the first real book behind the pre-existing 'science' app subjectId,
 * which already spanned grades 1-9 with nothing behind it. Grade 8 is the last
 * grade NCCD teaches science as one subject; from Grade 9 up it splits into
 * chemistry/physics/biology/earth science, which is why those four are
 * permanently bookless at grade-8 and 'science' is permanently bookless at
 * grade-10 — see subjectGradeCoverage.test.ts.
 *
 * Unlike the Grade 9 science books, `periods` is populated: a teacher guide
 * for this semester IS on disk, and prints «عدد الحصص» per lesson in the
 * lesson table that follows each unit's «مصفوفة النتاجات» (which also supplies
 * `prior_knowledge`). One lesson is the exception — u1_l2 carries two
 * different counts on facing pages, so it stays null rather than picking one;
 * the JSON's `known_gaps` says so.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g8_science_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G8_SCIENCE_S1_BOOK_ID = 'kb-science-8-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G8_SCIENCE_S1_CURRICULUM_BOOK_ID = 'book-science-8-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-8', subject: 'science', semester: 1 },
  kbBookId: G8_SCIENCE_S1_BOOK_ID,
  browserBookId: G8_SCIENCE_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG8ScienceSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g8-science-s1-nccd-u1). */
export const g8ScienceSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g8-science-s1-nccd-u1_l1). */
export const g8ScienceSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG8ScienceSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG8ScienceSem1Catalog = catalog.buildCatalog;
export const buildG8ScienceSem1BrowserCatalog = catalog.buildBrowserCatalog;
