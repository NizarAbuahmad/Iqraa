/**
 * Grade 6 Science (العلوم) — Semester 1 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g6_science_sem1.json
 *
 * Built through `makeNccdCatalog` — this book prints the exact shape that
 * factory assumes on every lesson opener («الفِكْرَةُ الرَّئيسَةُ» and a
 * bilingual «المَفاهيمُ وَالمُصْطَلَحاتُ») and on every unit opener
 * («الفِكْرَةُ العامَّةُ»).
 *
 * The second grade to carry the pre-existing 'science' subjectId, after Grade
 * 8. Both are grades where NCCD teaches science as ONE book; grade-9 and
 * grade-10 dissolve it into physics/chemistry/biology/earth-science, which is
 * why 'science' is permanently bookless at those two and those four are
 * permanently bookless here — see subjectGradeCoverage.test.ts.
 *
 * Unlike the Grade 8 science book, `objectives` is empty throughout: the Grade
 * 6 student book prints no «نتاجاتُ التعلُّمِ» box. The outcomes exist only in
 * the teacher guide's «مصفوفةُ مؤشِّراتِ الأداءِ», which mixes lesson-specific
 * indicators with generic ones (عاداتُ العقلِ، البحثُ العلميُّ) repeated across
 * lessons — so they are left empty rather than transcribed into noise. The
 * JSON's `known_gaps` names the matrix as the source to mine.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g6_science_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G6_SCIENCE_S1_BOOK_ID = 'kb-science-6-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G6_SCIENCE_S1_CURRICULUM_BOOK_ID = 'book-science-6-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-6', subject: 'science', semester: 1 },
  kbBookId: G6_SCIENCE_S1_BOOK_ID,
  browserBookId: G6_SCIENCE_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG6ScienceSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g6-science-s1-nccd-u1). */
export const g6ScienceSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g6-science-s1-nccd-u1_l1). */
export const g6ScienceSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG6ScienceSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

export const buildG6ScienceSem1Catalog = catalog.buildCatalog;
export const buildG6ScienceSem1BrowserCatalog = catalog.buildBrowserCatalog;
