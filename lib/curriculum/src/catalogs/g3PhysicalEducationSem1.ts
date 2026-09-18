/**
 * Grade 3 Physical Education (التربية الرياضية) — Semester 1 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g3_physical_education_sem1.json
 *
 * Unlike g6PhysicalEducationSem1.ts (title-only), this book prints a
 * "الفِكْرَةُ الرَّئيسَة" box and a bilingual "المَفاهيمُ وَالمُصْطَلَحاتُ الأَساسِيَّةُ"
 * glossary on every lesson's opener page, so main_idea_ar and vocabulary are
 * both transcribed for all 14 lessons. objectives are left empty — this book
 * has no separate learning-outcomes box; see the JSON's known_gaps.
 *
 * This subject reached grade-3 only when `SUBJECTS.grades` was extended for
 * it — it had been declared for grade-6/7/9 alone, which would have left the
 * book catalogued and permanently unreachable. See catalog.ts.
 *
 * Semester 1 only — no Semester 2 book exists in the supplied set, same gap
 * as g6PhysicalEducationSem1.ts.
 */

import raw from '../data/iqra_curriculum_g3_physical_education_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G3_PE_S1_BOOK_ID = 'kb-pe-3-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G3_PE_S1_CURRICULUM_BOOK_ID = 'book-pe-3-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-3', subject: 'pe', semester: 1 },
  kbBookId: G3_PE_S1_BOOK_ID,
  browserBookId: G3_PE_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG3PhysicalEducationSem1: NccdCurriculumFile = catalog.curriculum;
export const g3PhysicalEducationSem1UnitKbId = catalog.unitKbId;
export const g3PhysicalEducationSem1LessonKbId = catalog.lessonKbId;
export const findG3PhysicalEducationSem1LessonByKbId = catalog.findLessonByKbId;
export const buildG3PhysicalEducationSem1Catalog = catalog.buildCatalog;
export const buildG3PhysicalEducationSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G3PhysicalEducationSem1Lesson };
