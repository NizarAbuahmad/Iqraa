/**
 * Grade 1 Physical Education (التربية الرياضية) — Semester 2 (NCCD student
 * book). Source of truth: data/iqra_curriculum_g1_physical_education_sem2.json
 *
 * Unlike g6PhysicalEducationSem1.ts (title-only), this book prints a
 * «الفِكْرَةُ الرَّئيسَةُ» box and a bilingual «المَفاهيمُ وَالمُصْطَلَحاتُ
 * الأَساسِيَّةُ» glossary on every lesson's opener page, so main_idea_ar and
 * vocabulary are both transcribed for all 14 lessons — same shape as
 * g3PhysicalEducationSem1.ts. objectives are left empty — this book has no
 * separate learning-outcomes box; see the JSON's known_gaps.
 *
 * This subject reached grade-1 only when `SUBJECTS.grades` was extended for
 * it — it had been declared for grade-3/6/7/9 alone, which would have left
 * the book catalogued and permanently unreachable. See catalog.ts.
 *
 * Semester 2 only — no Semester 1 book exists in the supplied set, the
 * opposite gap from g3PhysicalEducationSem1.ts/g6PhysicalEducationSem1.ts.
 * Units are numbered 4-6, continuing the book's own whole-year numbering.
 */

import raw from '../data/iqra_curriculum_g1_physical_education_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G1_PE_S2_BOOK_ID = 'kb-pe-1-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G1_PE_S2_CURRICULUM_BOOK_ID = 'book-pe-1-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-1', subject: 'pe', semester: 2 },
  kbBookId: G1_PE_S2_BOOK_ID,
  browserBookId: G1_PE_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG1PhysicalEducationSem2: NccdCurriculumFile = catalog.curriculum;
export const g1PhysicalEducationSem2UnitKbId = catalog.unitKbId;
export const g1PhysicalEducationSem2LessonKbId = catalog.lessonKbId;
export const findG1PhysicalEducationSem2LessonByKbId = catalog.findLessonByKbId;
export const buildG1PhysicalEducationSem2Catalog = catalog.buildCatalog;
export const buildG1PhysicalEducationSem2BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G1PhysicalEducationSem2Lesson };
