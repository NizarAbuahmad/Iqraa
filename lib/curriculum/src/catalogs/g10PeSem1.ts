/**
 * Grade 10 Physical Education (التربية الرياضية) — Semester 1 (NCCD student
 * book, 2026 edition). Real-content layout, same shape as
 * g5PhysicalEducationSem1.ts and g9PeSem1.ts: each lesson opener prints its
 * own «الفكرة الرئيسة» box and, in 10 of the 13 lessons, a bilingual
 * «المفاهيم والمصطلحات» glossary — both transcribed. 5 units / 13 lessons:
 * football, basketball, badminton, movement expression, general safety (heat
 * stroke first aid). objectives are left empty — the printed «أقيّم تعلّمي»
 * box is a first-person self-assessment rubric, not a curricular outcomes
 * list; see the JSON's known_gaps.
 *
 * Closes the `physical-education:grade-10` gap, the last one left from the
 * Grade 9 batch: SUBJECTS.grades is extended for grade-10 (see catalog.ts).
 * grade-10 is `IMPLICIT_GRADE_ID` in curriculumIds.ts, so unit/lesson ids and
 * bank tags carry no `g10-` segment (`kbu-pe-s1-nccd-u1`, tag `pe-s1`), same
 * as g10CreativeArts.ts.
 */

import raw from '../data/iqra_curriculum_g10_physical_education_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G10_PE_S1_BOOK_ID = 'kb-pe-10-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G10_PE_S1_CURRICULUM_BOOK_ID = 'book-pe-10-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-10', subject: 'pe', semester: 1 },
  kbBookId: G10_PE_S1_BOOK_ID,
  browserBookId: G10_PE_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG10PeSem1: NccdCurriculumFile = catalog.curriculum;
export const g10PeSem1UnitKbId = catalog.unitKbId;
export const g10PeSem1LessonKbId = catalog.lessonKbId;
export const findG10PeSem1LessonByKbId = catalog.findLessonByKbId;
export const buildG10PeSem1Catalog = catalog.buildCatalog;
export const buildG10PeSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G10PeSem1Lesson };
