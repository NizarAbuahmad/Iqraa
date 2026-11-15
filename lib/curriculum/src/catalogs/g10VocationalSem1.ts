/**
 * Grade 10 Vocational Education (التربية المهنية) — Semester 1 (Ministry of
 * Education student book, 2016 edition reprinted 2017-2019 — NOT an NCCD
 * book). Nine «chapters» (the book's word for a lesson) in four units:
 * medical conditions (diabetes, blood pressure, epilepsy), economic projects
 * (small projects, oyster mushrooms, dairy), voluntary work, and trades
 * (sewing, painting).
 *
 * The book prints no main-idea box, no glossary and no unit general idea, so
 * those fields are empty on purpose; each chapter's «يتوقع منك بعد دراسة هذا
 * الفصل أن» list is the objectives. Its text layer is garbled (see the JSON's
 * known_gaps), so the objectives are a reconstruction to be checked against
 * the page images.
 *
 * Part 2 of the Grade 10 pair (vocational-p2-student-book) is a Grade 9 book
 * by mistake, so there is no Semester 2 here.
 *
 * grade-10 is `IMPLICIT_GRADE_ID` in curriculumIds.ts, so unit/lesson ids and
 * bank tags carry no `g10-` segment (`kbu-voc-s1-nccd-u1`, tag `voc-s1`), same
 * as g10PeSem1.ts.
 */

import raw from '../data/iqra_curriculum_g10_vocational_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G10_VOC_S1_BOOK_ID = 'kb-voc-10-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G10_VOC_S1_CURRICULUM_BOOK_ID = 'book-voc-10-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-10', subject: 'voc', semester: 1 },
  kbBookId: G10_VOC_S1_BOOK_ID,
  browserBookId: G10_VOC_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG10VocSem1: NccdCurriculumFile = catalog.curriculum;
export const g10VocSem1UnitKbId = catalog.unitKbId;
export const g10VocSem1LessonKbId = catalog.lessonKbId;
export const findG10VocSem1LessonByKbId = catalog.findLessonByKbId;
export const buildG10VocSem1Catalog = catalog.buildCatalog;
export const buildG10VocSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G10VocSem1Lesson };
