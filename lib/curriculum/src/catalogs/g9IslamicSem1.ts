/**
 * Grade 9 Islamic Education (التربية الإسلامية) — Semester 1 (NCCD student book).
 *
 * This book prints no نتاجات التعلم box on any lesson opener — unlike Grade 10
 * Islamic, where the teacher guide supplies them. No teacher guide for this
 * semester is on disk, so `objectives` is empty for every lesson, same
 * precedent as Digital Skills Grade 10 when its guide was likewise absent.
 * Unit openers carry only a Qur'anic ayah and a bare "الوحدةُ الأولى" etc.
 * title, no descriptive title or prose lead-in — `general_idea_ar` is empty
 * for the same reason.
 *
 * The book's own PDF is 143MB, over the Read tool's 100MB direct-PDF cap, so
 * every title and main idea here was read from the lesson openers rasterized
 * to PNG (pdftoppm), not from any text extraction.
 */

import raw from '../data/iqra_curriculum_g9_islamic_sem1.json' with { type: 'json' };
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

export const G9_ISLAMIC_S1_BOOK_ID = 'kb-islamic-9-s1';
export const G9_ISLAMIC_S1_CURRICULUM_BOOK_ID = 'book-islamic-9-s1';

const catalog = makeNccdCatalog({
  scope: { gradeId: 'grade-9', subject: 'islamic', semester: 1 },
  kbBookId: G9_ISLAMIC_S1_BOOK_ID,
  browserBookId: G9_ISLAMIC_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG9IslamicSem1: NccdCurriculumFile = catalog.curriculum;
export const g9IslamicSem1UnitKbId = catalog.unitKbId;
export const g9IslamicSem1LessonKbId = catalog.lessonKbId;
export const findG9IslamicSem1LessonByKbId = catalog.findLessonByKbId;
export const buildG9IslamicSem1Catalog = catalog.buildCatalog;
export const buildG9IslamicSem1BrowserCatalog = catalog.buildBrowserCatalog;

export type { NccdLesson as G9IslamicSem1Lesson };
