/**
 * Grade 3 Physical Education (التربية الرياضية) — Semester 2 (NCCD student
 * book). Same real-content layout as g3PhysicalEducationSem1.ts: each lesson
 * opener prints its own «الفِكْرَةُ الرَّئيسَةُ» box and a bilingual
 * «المَفاهيمُ وَالمُصْطَلَحاتُ الأَساسِيَّةُ» glossary, both transcribed for all
 * 14 lessons. Units continue Semester 1's numbering (4 and 5 — printed that
 * way in the book itself, not renumbered from 1): coordination games, and
 * acting-and-chanting movements. objectives are left empty — the book has no
 * separate learning-outcomes box and no teacher guide; see the JSON's
 * known_gaps.
 *
 * Together with g3PhysicalEducationSem1.ts this gives Grade 3 Physical
 * Education both semesters.
 */

import raw from '../data/iqra_curriculum_g3_physical_education_sem2.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G3_PE_S2_BOOK_ID = 'kb-pe-3-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G3_PE_S2_CURRICULUM_BOOK_ID = 'book-pe-3-s2';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-3', subject: 'pe', semester: 2 },
  kbBookId: G3_PE_S2_BOOK_ID,
  browserBookId: G3_PE_S2_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG3PhysicalEducationSem2: NccdCurriculumFile = catalog.curriculum;
export const g3PhysicalEducationSem2UnitKbId = catalog.unitKbId;
export const g3PhysicalEducationSem2LessonKbId = catalog.lessonKbId;
export const findG3PhysicalEducationSem2LessonByKbId = catalog.findLessonByKbId;
export const buildG3PhysicalEducationSem2Catalog = catalog.buildCatalog;
export const buildG3PhysicalEducationSem2BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G3PhysicalEducationSem2Lesson };
