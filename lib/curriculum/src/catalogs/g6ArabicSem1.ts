/**
 * Grade 6 Arabic (العربية لغتي) — Semester 1 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g6_arabic_sem1.json
 *
 * **Title-only, and that is the honest shape of this book** — not a shortfall
 * in the transcription. The Arabic student book prints none of what the science
 * books print: no «نتاجاتُ التعلُّمِ», no «الفِكْرَةُ الرَّئيسَةُ», no
 * «المَفاهيمُ وَالمُصْطَلَحاتُ». A lesson page opens straight into an activity
 * (أَسْتَعِدُّ لِلاسْتِماعِ, أَسْتَمِعُ وَأَتَذَكَّرُ, then questions), so
 * `objectives`, `vocabulary` and `main_idea_ar` are empty everywhere.
 *
 * Because of that, every unit and lesson here answers true to the title-only
 * predicates below, which `catalog.ts` folds into `isBrowserUnitTitleOnly` /
 * `isBrowserLessonTitleOnly`. The UI then says "title confirmed, no per-lesson
 * objectives yet" instead of rendering a lesson that merely looks empty. The
 * predicates are a plain prefix test rather than a `data_tier` lookup precisely
 * because the answer is the same for the whole book — there is no mixed tier
 * here as there is in g9MathSem1.
 *
 * The structure is unusually regular: five units, each with the same five
 * lessons in the same order — listening, speaking, reading, writing, then
 * «أَبْني لُغَتي» for the grammar or morphology point. The parenthetical in a
 * lesson title is that lesson's topic as the contents page prints it.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g6_arabic_sem1.json' with { type: 'json' };
import { lessonKbPrefix, unitKbPrefix, type CurriculumIdScope } from '../curriculumIds.ts';
import { makeNccdCatalog, type NccdCurriculumFile, type NccdLesson } from './nccdCatalog.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const G6_ARABIC_S1_BOOK_ID = 'kb-arabic-6-s1';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G6_ARABIC_S1_CURRICULUM_BOOK_ID = 'book-arabic-6-s1';

const SCOPE: CurriculumIdScope = { gradeId: 'grade-6', subject: 'arabic', semester: 1 };

const catalog = makeNccdCatalog({
  scope: SCOPE,
  kbBookId: G6_ARABIC_S1_BOOK_ID,
  browserBookId: G6_ARABIC_S1_CURRICULUM_BOOK_ID,
  raw,
});

export const nccdG6ArabicSem1: NccdCurriculumFile = catalog.curriculum;

/** Stable KB unit id (e.g. u1 → kbu-g6-arabic-s1-nccd-u1). */
export const g6ArabicSem1UnitKbId = catalog.unitKbId;

/** Stable KB lesson id (e.g. u1_l1 → kbl-g6-arabic-s1-nccd-u1_l1). */
export const g6ArabicSem1LessonKbId = catalog.lessonKbId;

/** Look up a JSON lesson by mapped KB lesson id. */
export const findG6ArabicSem1LessonByKbId: (kbLessonId: string) => NccdLesson | null =
  catalog.findLessonByKbId;

/** True for every unit in this book — see the header for why it is unconditional. */
export function isG6ArabicSem1TitleOnlyUnit(unitKbId: string): boolean {
  return unitKbId.startsWith(unitKbPrefix(SCOPE));
}

/** True for every lesson in this book — see the header for why it is unconditional. */
export function isG6ArabicSem1TitleOnlyLesson(kbLessonId: string): boolean {
  return kbLessonId.startsWith(lessonKbPrefix(SCOPE));
}

export const buildG6ArabicSem1Catalog = catalog.buildCatalog;
export const buildG6ArabicSem1BrowserCatalog = catalog.buildBrowserCatalog;
