/**
 * Grade 4 Physical Education (التربية الرياضية) — Semester 1 (NCCD student
 * book, 2026 edition). Real-content layout, same shape as
 * g5PhysicalEducationSem1.ts and g10PeSem1.ts: each lesson opener prints its
 * own «الفِكْرَةُ الرَّئيسَةُ» box and a bilingual «المَفاهيمُ
 * وَالمُصْطَلَحاتُ» glossary, both transcribed for all 13 lessons across 3
 * units (football, badminton, general safety). objectives are left empty —
 * the printed «أُقيِّمُ تعلُّمي» box is a first-person self-assessment rubric,
 * not a curricular outcomes list; see the JSON's known_gaps.
 *
 * First Grade 4 PE book in the repo: `SUBJECTS.grades` is extended for
 * grade-4 (see catalog.ts), closing `physical-education:grade-4`, which
 * subjectGradeCoverage.test.ts had listed as permanently bookless on the
 * assumption that no Grade 4 PE book exists. Semester 2 is not attached yet.
 */

import raw from '../data/iqra_curriculum_g4_physical_education_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G4_PE_S1_BOOK_ID = 'kb-pe-4-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G4_PE_S1_CURRICULUM_BOOK_ID = 'book-pe-4-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-4', subject: 'pe', semester: 1 },
  kbBookId: G4_PE_S1_BOOK_ID,
  browserBookId: G4_PE_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG4PhysicalEducationSem1: NccdCurriculumFile = catalog.curriculum;
export const g4PhysicalEducationSem1UnitKbId = catalog.unitKbId;
export const g4PhysicalEducationSem1LessonKbId = catalog.lessonKbId;
export const findG4PhysicalEducationSem1LessonByKbId = catalog.findLessonByKbId;
export const buildG4PhysicalEducationSem1Catalog = catalog.buildCatalog;
export const buildG4PhysicalEducationSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G4PhysicalEducationSem1Lesson };
