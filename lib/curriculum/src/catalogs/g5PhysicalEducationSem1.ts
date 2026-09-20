/**
 * Grade 5 Physical Education (التربية الرياضية) — Semester 1 (NCCD student
 * book). Real-content layout, same shape as g3PhysicalEducationSem1.ts: each
 * lesson prints its own «الفِكْرَةُ الرَّئيسَةُ» box and bilingual «المَفاهيمُ
 * وَالمُصْطَلَحاتُ الأَساسِيَّةُ» glossary, both transcribed for all 15 lessons
 * across 4 units (football, badminton, rhythmic movement, general safety).
 * objectives are left empty — the printed «نَتاجاتُ التَّعَلُّمِ» box is a
 * first-person self-assessment rubric, not a curricular outcomes list; see
 * the JSON's known_gaps.
 *
 * This subject's student books for BOTH semesters existed on disk but the
 * subject had never been declared for grade-5 in `SUBJECTS.grades` (only
 * grade-1/2/3/6/7/9) — the same catalogued-but-unreachable trap every prior
 * grade's PE/Art/Vocational rollout hit. See catalog.ts.
 */

import raw from '../data/iqra_curriculum_g5_physical_education_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G5_PE_S1_BOOK_ID = 'kb-pe-5-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G5_PE_S1_CURRICULUM_BOOK_ID = 'book-pe-5-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-5', subject: 'pe', semester: 1 },
  kbBookId: G5_PE_S1_BOOK_ID,
  browserBookId: G5_PE_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG5PhysicalEducationSem1: NccdCurriculumFile = catalog.curriculum;
export const g5PhysicalEducationSem1UnitKbId = catalog.unitKbId;
export const g5PhysicalEducationSem1LessonKbId = catalog.lessonKbId;
export const findG5PhysicalEducationSem1LessonByKbId = catalog.findLessonByKbId;
export const buildG5PhysicalEducationSem1Catalog = catalog.buildCatalog;
export const buildG5PhysicalEducationSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G5PhysicalEducationSem1Lesson };
