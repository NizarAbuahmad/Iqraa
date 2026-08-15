/**
 * Grade 2 Mathematics — full year (NCCD student books + teacher guide).
 * Source of truth: data/iqra_curriculum_g2_math.json
 *
 * Provenance is per-unit, and the `data_tier` field says which — the same
 * honesty mechanism Math G10 S1 uses:
 *  • 'teacher_guide'        (units 7–10): per-lesson نتاجات, مصطلحات and حصص
 *                           from the دليل المعلم «مخطط الوحدة» tables.
 *  • 'student_book_lesson'  (unit 6): outcomes from the أتعلم اليوم boxes in
 *                           the student book's lesson openers — authentic,
 *                           but terser than the guide, and no period counts.
 *  • 'title_only'           (units 1–5): lesson titles from the S1 table of
 *                           contents. The guide for units 1–6 was not among
 *                           the delivered files; NOTHING was invented to fill
 *                           the gap (see meta.known_gaps).
 *
 * One JSON, two KB books: the year splits into semester books because every
 * surface downstream (TopicSelector's semester grouping, the browse tab)
 * models a semester as a book, exactly like G10.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g2_math.json' with { type: 'json' };

/** Book ids in KB_BOOKS that this JSON populates. */
export const G2_MATH_S1_BOOK_ID = 'kb-math-2-s1';
export const G2_MATH_S2_BOOK_ID = 'kb-math-2-s2';

export type G2MathVocab = { ar: string; en: string };

export type G2MathLesson = {
  id: string;
  order: number;
  title_ar: string;
  title_en: string;
  main_idea_ar: string;
  periods: number | null;
  objectives: string[];
  vocabulary: G2MathVocab[];
};

export type G2MathDataTier = 'teacher_guide' | 'student_book_lesson' | 'title_only';

export type G2MathUnit = {
  id: string;
  number: number;
  semester: 1 | 2;
  title_ar: string;
  title_en: string;
  general_idea_ar: string;
  total_periods: number | null;
  data_tier: G2MathDataTier;
  lessons: G2MathLesson[];
};

export type G2MathCurriculumFile = {
  meta: Record<string, unknown>;
  units: G2MathUnit[];
};

export const nccdG2Math = raw as G2MathCurriculumFile;

export function g2MathUnitKbId(jsonUnitId: string): string {
  return `kbu-${jsonUnitId}`;
}

export function g2MathLessonKbId(jsonLessonId: string): string {
  return `kbl-${jsonLessonId}`;
}

export function findG2MathLessonByKbId(kbLessonId: string): G2MathLesson | null {
  for (const unit of nccdG2Math.units) {
    for (const lesson of unit.lessons) {
      if (g2MathLessonKbId(lesson.id) === kbLessonId) return lesson;
    }
  }
  return null;
}

export function findG2MathUnitByLessonKbId(kbLessonId: string): G2MathUnit | null {
  for (const unit of nccdG2Math.units) {
    for (const lesson of unit.lessons) {
      if (g2MathLessonKbId(lesson.id) === kbLessonId) return unit;
    }
  }
  return null;
}

/** True when a unit carries titles but no per-lesson outcomes yet. */
export function isG2MathTitleOnlyTier(tier: G2MathDataTier): boolean {
  return tier === 'title_only';
}

/** Shape compatible with KBUnit / KBLesson in knowledgeBase.ts */
type G2KbUnit = {
  id: string;
  bookId: string;
  order: number;
  titleAr: string;
  titleEn: string;
};

type G2KbLesson = {
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

export function buildG2MathCatalog(): { units: G2KbUnit[]; lessons: G2KbLesson[] } {
  const units: G2KbUnit[] = nccdG2Math.units.map(u => ({
    id: g2MathUnitKbId(u.id),
    bookId: u.semester === 1 ? G2_MATH_S1_BOOK_ID : G2_MATH_S2_BOOK_ID,
    order: u.number,
    titleAr: u.title_ar,
    titleEn: u.title_en,
  }));

  const lessons: G2KbLesson[] = [];
  for (const u of nccdG2Math.units) {
    const unitKbId = g2MathUnitKbId(u.id);
    for (const lesson of u.lessons) {
      const vocab = lesson.vocabulary ?? [];
      lessons.push({
        id: g2MathLessonKbId(lesson.id),
        unitId: unitKbId,
        order: lesson.order,
        titleAr: lesson.title_ar,
        titleEn: lesson.title_en,
        // The summary states where the lesson sits, never what the book did
        // not say — a title-only lesson must not read as if it had content.
        summaryAr: lesson.main_idea_ar
          || `درس «${lesson.title_ar}» من وحدة «${u.title_ar}».`,
        summaryEn: lesson.main_idea_ar
          ? lesson.main_idea_ar
          : `Lesson “${lesson.title_en}” from unit “${u.title_en}”.`,
        keyConceptsAr: vocab.map(v => v.ar),
        keyConceptsEn: vocab.map(v => v.en),
        keyTerms: vocab.map(v => ({
          ar: v.ar,
          en: v.en,
          definitionAr: '',
          definitionEn: '',
        })),
        objectives: [...lesson.objectives],
        periods: lesson.periods ?? null,
      });
    }
  }

  return { units, lessons };
}
