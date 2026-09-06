/**
 * Grade 10 Arabic (العربية لغتي) — Semester 1 curriculum (NCCD).
 * Source of truth: data/iqra_curriculum_g10_arabic_sem1.json
 *
 * Unit openers print نتاجات التعلم, the way financial literacy's do. Three
 * things about this book are worth knowing:
 *
 * - Every unit runs the same five skills in the same order (أستمع / أتحدّث /
 *   أقرأ / أكتب محتوًى / أبني لغتي), so `title_ar` alone does not identify a
 *   lesson across units. Ids do; nothing here derives a lesson from its title.
 * - The book prints no per-lesson term list, so `vocabulary` is empty for every
 *   lesson and `keyConcepts*` come out empty rather than invented.
 * - Since 2026-09-05 every lesson carries a real `periods` (2-5 حصص) read from
 *   the teacher guide's «مخطط الوحدة», which prints the count inside each
 *   lesson heading. Semester 2 still has none — there is no S2 teacher guide in
 *   the repo — so the two books differ on this and only this.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g10_arabic_sem1.json' with { type: 'json' };
import {
  lessonKbId,
  lessonKbPrefix,
  objectiveId,
  unitKbId,
  type CurriculumIdScope,
} from '../curriculumIds.ts';

/** Book id in KB_BOOKS this catalog belongs to (new subject — no legacy rows). */
export const ARABIC_S1_BOOK_ID = 'kb-arabic-10-s1';

export type ArabicSem1Vocab = { ar: string; en: string };

export type ArabicSem1Lesson = {
  id: string;
  order: number;
  title_ar: string;
  title_en: string;
  main_idea_ar: string;
  periods: number | null;
  objectives: string[];
  vocabulary: ArabicSem1Vocab[];
};

export type ArabicSem1Unit = {
  id: string;
  number: number;
  title_ar: string;
  title_en: string;
  general_idea_ar: string;
  total_periods: number | null;
  lessons: ArabicSem1Lesson[];
};

export type ArabicSem1CurriculumFile = {
  meta: Record<string, unknown>;
  units: ArabicSem1Unit[];
};

export const nccdG10ArabicSem1 = raw as ArabicSem1CurriculumFile;

/** Shape compatible with KBUnit / KBLesson in knowledgeBase.ts */
type ArabicKbUnit = {
  id: string;
  bookId: string;
  order: number;
  titleAr: string;
  titleEn: string;
};

type ArabicKbLesson = {
  id: string;
  unitId: string;
  order: number;
  titleAr: string;
  titleEn: string;
  summaryAr: string;
  summaryEn: string;
  keyConceptsAr: string[];
  keyConceptsEn: string[];
  keyTerms: Array<{ ar: string; en: string; definitionAr: string; definitionEn: string }>;
  objectives: string[];
  periods: number | null;
};

/** What this catalog's ids are scoped to. */
const SCOPE: CurriculumIdScope = { gradeId: 'grade-10', subject: 'arabic', semester: 1 };

/** Stable KB unit id (e.g. u1 → kbu-arabic-s1-nccd-u1). */
export function arabicSem1UnitKbId(jsonUnitId: string): string {
  return unitKbId(SCOPE, jsonUnitId);
}

/** Stable KB lesson id (e.g. u1_l1 → kbl-arabic-s1-nccd-u1_l1). */
export function arabicSem1LessonKbId(jsonLessonId: string): string {
  return lessonKbId(SCOPE, jsonLessonId);
}

/** Look up a JSON lesson by mapped KB lesson id. */
export function findArabicSem1LessonByKbId(kbLessonId: string): ArabicSem1Lesson | null {
  const prefix = lessonKbPrefix(SCOPE);
  if (!kbLessonId.startsWith(prefix)) return null;
  const jsonId = kbLessonId.slice(prefix.length);
  for (const u of nccdG10ArabicSem1.units) {
    const hit = u.lessons.find(l => l.id === jsonId);
    if (hit) return hit;
  }
  return null;
}

/**
 * Map the Arabic JSON into KB units + lessons for book kb-arabic-10-s1.
 * Arabic strings are copied byte-for-byte from the JSON (which copies the
 * student book).
 */
export function buildArabicSem1Catalog(): { units: ArabicKbUnit[]; lessons: ArabicKbLesson[] } {
  const units: ArabicKbUnit[] = nccdG10ArabicSem1.units.map(u => ({
    id: arabicSem1UnitKbId(u.id),
    bookId: ARABIC_S1_BOOK_ID,
    order: u.number,
    titleAr: u.title_ar,
    titleEn: u.title_en,
  }));

  const lessons: ArabicKbLesson[] = [];
  for (const u of nccdG10ArabicSem1.units) {
    const unitKbId = arabicSem1UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const vocab = lesson.vocabulary ?? [];
      const objectives = lesson.objectives ?? [];
      lessons.push({
        id: arabicSem1LessonKbId(lesson.id),
        unitId: unitKbId,
        order: lesson.order,
        titleAr: lesson.title_ar,
        titleEn: lesson.title_en,
        summaryAr: objectives.length
          ? objectives.join('؛ ')
          : `درس «${lesson.title_ar}» من وحدة «${u.title_ar}».`,
        summaryEn: objectives.length
          ? objectives.join('; ')
          : `Lesson “${lesson.title_en}” from unit “${u.title_en}”.`,
        keyConceptsAr: vocab.map(v => v.ar),
        keyConceptsEn: vocab.map(v => v.en || v.ar),
        keyTerms: vocab.map(v => ({
          ar: v.ar,
          en: v.en || v.ar,
          definitionAr: '',
          definitionEn: '',
        })),
        objectives: [...objectives],
        periods: lesson.periods ?? null,
      });
    }
  }

  return { units, lessons };
}

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const ARABIC_S1_CURRICULUM_BOOK_ID = 'book-arabic-10-s1';

/** Shape compatible with Unit / Lesson in curriculumData.ts */
type ArabicBrowserUnit = {
  id: string;
  bookId: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  order: number;
};

type ArabicBrowserLesson = {
  id: string;
  unitId: string;
  title: string;
  titleAr: string;
  estimatedDuration: number;
  objectives: string[];
  objectivesAr: string[];
  keywords: string[];
  keywordsAr: string[];
  teacherNotes: string;
  teacherNotesAr: string;
  outcomes: Array<{
    id: string;
    lessonId: string;
    description: string;
    descriptionAr: string;
    bloomsLevel: 'Understand';
    skills: string[];
  }>;
};

/**
 * Map the Arabic JSON into curriculum-browser Unit/Lesson rows for
 * book-arabic-10-s1. Same ids as the KB catalog above, so a lesson picked in
 * the browser and the same lesson pulled from the KB agree.
 *
 * `periods` comes from the teacher guide, so estimatedDuration is a real
 * multiple of 45 here; the `?? 1` fallback is kept only because the S2 catalog
 * next door still needs it.
 */
export function buildArabicSem1BrowserCatalog(): {
  units: ArabicBrowserUnit[];
  lessons: ArabicBrowserLesson[];
} {
  const units: ArabicBrowserUnit[] = nccdG10ArabicSem1.units.map(u => {
    const lessonTitles = u.lessons.map(l => l.title_ar).join(' · ');
    return {
      id: arabicSem1UnitKbId(u.id),
      bookId: ARABIC_S1_CURRICULUM_BOOK_ID,
      name: u.title_en,
      nameAr: u.title_ar,
      description: lessonTitles,
      descriptionAr: lessonTitles,
      order: u.number,
    };
  });

  const lessons: ArabicBrowserLesson[] = [];
  for (const u of nccdG10ArabicSem1.units) {
    const unitKbId = arabicSem1UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const objectives = [...(lesson.objectives ?? [])];
      const vocabulary = (lesson.vocabulary ?? []).map(v => v.ar);
      const lessonKbId = arabicSem1LessonKbId(lesson.id);
      lessons.push({
        id: lessonKbId,
        unitId: unitKbId,
        title: lesson.title_ar,
        titleAr: lesson.title_ar,
        estimatedDuration: (lesson.periods ?? 1) * 45,
        objectives,
        objectivesAr: [...objectives],
        keywords: [...vocabulary],
        keywordsAr: [...vocabulary],
        teacherNotes: '',
        teacherNotesAr: '',
        outcomes: objectives.map((o, i) => ({
          id: objectiveId(SCOPE, lesson.id, i),
          lessonId: lessonKbId,
          description: o,
          descriptionAr: o,
          bloomsLevel: 'Understand' as const,
          skills: [] as string[],
        })),
      });
    }
  }

  return { units, lessons };
}
