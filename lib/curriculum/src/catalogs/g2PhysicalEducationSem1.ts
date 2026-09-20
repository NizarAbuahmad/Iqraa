/**
 * Grade 2 Physical Education (التربية الرياضية) — Semester 1 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g2_physical_education_sem1.json
 *
 * Unlike g6PhysicalEducationSem1.ts (title-only), this book prints a
 * "الفِكْرَةُ الرَّئيسَة" box and a bilingual "المَفاهيمُ وَالمُصْطَلَحاتُ الأَساسِيَّةُ"
 * glossary on every lesson's opener page, so main_idea_ar and vocabulary are
 * both transcribed for all 14 lessons — same shape as g3PhysicalEducationSem1.ts.
 * objectives are left empty — this book has no separate learning-outcomes
 * box; see the JSON's known_gaps.
 *
 * This subject reaches grade-2 only when `SUBJECTS.grades` is extended for
 * it — it had been declared for grade-1/3/6/7/9 alone, which would have
 * left the book catalogued and permanently unreachable. See catalog.ts.
 *
 * Semester 1 only — no Semester 2 book exists in the supplied set, same gap
 * as g3PhysicalEducationSem1.ts/g6PhysicalEducationSem1.ts.
 */

import raw from '../data/iqra_curriculum_g2_physical_education_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G2_PE_S1_BOOK_ID = 'kb-pe-2-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G2_PE_S1_CURRICULUM_BOOK_ID = 'book-pe-2-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-2', subject: 'pe', semester: 1 },
  kbBookId: G2_PE_S1_BOOK_ID,
  browserBookId: G2_PE_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG2PhysicalEducationSem1: NccdCurriculumFile = catalog.curriculum;
export const g2PhysicalEducationSem1UnitKbId = catalog.unitKbId;
export const g2PhysicalEducationSem1LessonKbId = catalog.lessonKbId;
export const findG2PhysicalEducationSem1LessonByKbId = catalog.findLessonByKbId;
export const buildG2PhysicalEducationSem1Catalog = catalog.buildCatalog;
export const buildG2PhysicalEducationSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G2PhysicalEducationSem1Lesson };
