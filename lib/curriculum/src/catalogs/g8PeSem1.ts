/**
 * Grade 8 Physical Education (التربية الرياضية) — Semester 1 (NCCD student
 * book, 2026 edition). Real-content layout, same shape as g10PeSem1.ts and
 * g4PhysicalEducationSem1.ts: each lesson opener prints its own «الفكرة
 * الرئيسة» box and, in 11 of the 14 lessons, a bilingual «المفاهيم
 * والمصطلحات» glossary — both transcribed. 5 units / 14 lessons: football,
 * basketball, badminton, movement and rhythmic expression, general safety
 * (first aid for minor burns). objectives are left empty — the printed «أقيّم
 * تعلّمي» box is a first-person self-assessment rubric, not a curricular
 * outcomes list; see the JSON's known_gaps.
 *
 * Source: NCCD publishes this book ONLY as a view-only online flipbook (no
 * PDF), so it was read on screen through the viewer and `pdfUrl` is unset on
 * the catalog row — see the JSON's provenance_note.
 *
 * The last missing official NCCD student book: closes
 * `physical-education:grade-8`, SUBJECTS.grades is extended for grade-8 (see
 * catalog.ts). Semester 2 is not attached yet.
 */

import raw from '../data/iqra_curriculum_g8_physical_education_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G8_PE_S1_BOOK_ID = 'kb-pe-8-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G8_PE_S1_CURRICULUM_BOOK_ID = 'book-pe-8-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-8', subject: 'pe', semester: 1 },
  kbBookId: G8_PE_S1_BOOK_ID,
  browserBookId: G8_PE_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG8PeSem1: NccdCurriculumFile = catalog.curriculum;
export const g8PeSem1UnitKbId = catalog.unitKbId;
export const g8PeSem1LessonKbId = catalog.lessonKbId;
export const findG8PeSem1LessonByKbId = catalog.findLessonByKbId;
export const buildG8PeSem1Catalog = catalog.buildCatalog;
export const buildG8PeSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G8PeSem1Lesson };
