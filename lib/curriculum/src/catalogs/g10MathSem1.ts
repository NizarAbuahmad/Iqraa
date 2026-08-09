/**
 * Grade 10 Math — Semester 1 curriculum (NCCD).
 * Source of truth: data/iqra_curriculum_g10_math_sem1.json
 *
 * Two data tiers (see unit.data_tier):
 *  • Unit 1: lesson-level objectives/vocabulary/periods (teacher guide).
 *  • Units 2–4: title-only lessons; unit_objectives live on the unit object.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g10_math_sem1.json' with { type: 'json' };

/** Book id in KB_BOOKS that this JSON supersedes. */
export const NCCD_S1_BOOK_ID = 'kb-math-10-s1';

/** Curriculum-browser book id for Math G10 Semester 1. */
export const NCCD_S1_CURRICULUM_BOOK_ID = 'book-math-10';

export type NccdSem1DataTier =
  | 'lesson-level (teacher guide, framework-validated)'
  | 'unit-level only (student book)';

export type NccdSem1Lesson = {
  id: string;
  order: number;
  title_ar: string;
  periods: number | null;
  objectives: string[];
  vocabulary: string[];
  type?: string;
};

export type NccdSem1Unit = {
  id: string;
  number: number;
  title_ar: string;
  title_en: string;
  data_tier: NccdSem1DataTier | string;
  total_periods: number | null;
  unit_objectives?: string[];
  /**
   * Optional "تعلمت سابقًا" concepts for the unit.
   * Absent in current JSON — reserved for a follow-up data enrichment.
   */
  prior_knowledge?: string[];
  lessons: NccdSem1Lesson[];
  title_note?: string;
};

export type NccdSem1CurriculumFile = {
  meta: Record<string, unknown>;
  units: NccdSem1Unit[];
};

export const nccdG10MathSem1 = raw as NccdSem1CurriculumFile;

/** Shape compatible with KBUnit / KBLesson in knowledgeBase.ts */
export type NccdKbUnit = {
  id: string;
  bookId: string;
  order: number;
  titleAr: string;
  titleEn: string;
};

export type NccdKbLesson = {
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

/** Stable KB unit id (e.g. u1 → kbu-math-s1-nccd-u1). */
export function nccdSem1UnitKbId(jsonUnitId: string): string {
  return `kbu-math-s1-nccd-${jsonUnitId}`;
}

/** Stable KB lesson id (e.g. u1_l3 → kbl-math-s1-nccd-u1_l3). */
export function nccdSem1LessonKbId(jsonLessonId: string): string {
  return `kbl-math-s1-nccd-${jsonLessonId}`;
}

export function isNccdSem1TitleOnlyTier(dataTier: string | undefined): boolean {
  return typeof dataTier === 'string' && dataTier.startsWith('unit-level only');
}

/** True when a KB/browser unit id is a Sem1 title-only (units 2–4) unit. */
export function isNccdSem1TitleOnlyUnit(unitKbId: string): boolean {
  const prefix = 'kbu-math-s1-nccd-';
  if (!unitKbId.startsWith(prefix)) return false;
  const jsonId = unitKbId.slice(prefix.length);
  const unit = nccdG10MathSem1.units.find(u => u.id === jsonId);
  return !!unit && isNccdSem1TitleOnlyTier(unit.data_tier);
}

/** True when a KB/browser lesson id belongs to a Sem1 title-only unit. */
export function isNccdSem1TitleOnlyLesson(lessonKbId: string): boolean {
  const unit = findNccdSem1UnitByLessonKbId(lessonKbId);
  return !!unit && isNccdSem1TitleOnlyTier(unit.data_tier);
}

/** Look up JSON unit by mapped KB unit id. */
export function findNccdSem1UnitByKbId(unitKbId: string): NccdSem1Unit | null {
  const prefix = 'kbu-math-s1-nccd-';
  if (!unitKbId.startsWith(prefix)) return null;
  const jsonId = unitKbId.slice(prefix.length);
  return nccdG10MathSem1.units.find(u => u.id === jsonId) ?? null;
}

/** Look up JSON unit that owns a mapped KB lesson id. */
export function findNccdSem1UnitByLessonKbId(lessonKbId: string): NccdSem1Unit | null {
  const prefix = 'kbl-math-s1-nccd-';
  if (!lessonKbId.startsWith(prefix)) return null;
  const jsonId = lessonKbId.slice(prefix.length);
  for (const u of nccdG10MathSem1.units) {
    if (u.lessons.some(l => l.id === jsonId)) return u;
  }
  return null;
}

/** Look up a JSON lesson by mapped KB lesson id. */
export function findNccdSem1LessonByKbId(kbLessonId: string): NccdSem1Lesson | null {
  const prefix = 'kbl-math-s1-nccd-';
  if (!kbLessonId.startsWith(prefix)) return null;
  const jsonId = kbLessonId.slice(prefix.length);
  for (const u of nccdG10MathSem1.units) {
    const hit = u.lessons.find(l => l.id === jsonId);
    if (hit) return hit;
  }
  return null;
}

/**
 * Map the NCCD JSON into KB units + lessons for book kb-math-10-s1.
 * Arabic strings are copied byte-for-byte from the JSON.
 * Title-only lessons keep objectives/vocabulary empty (unit_objectives stay on the unit).
 */
export function buildNccdSem1Catalog(): { units: NccdKbUnit[]; lessons: NccdKbLesson[] } {
  const units: NccdKbUnit[] = nccdG10MathSem1.units.map(u => ({
    id: nccdSem1UnitKbId(u.id),
    bookId: NCCD_S1_BOOK_ID,
    order: u.number,
    titleAr: u.title_ar,
    titleEn: u.title_en,
  }));

  const lessons: NccdKbLesson[] = [];
  for (const u of nccdG10MathSem1.units) {
    const unitKbId = nccdSem1UnitKbId(u.id);
    const titleOnly = isNccdSem1TitleOnlyTier(u.data_tier);
    for (const lesson of u.lessons) {
      const vocab = lesson.vocabulary ?? [];
      const objectives = lesson.objectives ?? [];
      lessons.push({
        id: nccdSem1LessonKbId(lesson.id),
        unitId: unitKbId,
        order: lesson.order,
        titleAr: lesson.title_ar,
        titleEn: lesson.title_ar,
        summaryAr: objectives.length
          ? objectives.join('؛ ')
          : titleOnly
            ? `درس «${lesson.title_ar}» من وحدة «${u.title_ar}» (عنوان مؤكَّد — النتاجات على مستوى الوحدة).`
            : `درس «${lesson.title_ar}» من وحدة «${u.title_ar}».`,
        summaryEn: objectives.length
          ? objectives.join('; ')
          : titleOnly
            ? `Lesson “${lesson.title_ar}” from unit “${u.title_en}” (title confirmed — outcomes are unit-level).`
            : `Lesson “${lesson.title_ar}” from unit “${u.title_en}”.`,
        keyConceptsAr: [...vocab],
        keyConceptsEn: [...vocab],
        keyTerms: vocab.map(term => ({
          ar: term,
          en: term,
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

/** Shape compatible with Unit / Lesson in curriculumData.ts */
export type NccdBrowserUnit = {
  id: string;
  bookId: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  order: number;
};

export type NccdBrowserLesson = {
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
    bloomsLevel: 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create';
    skills: string[];
  }>;
};

/**
 * Map NCCD JSON into curriculum-browser Unit/Lesson rows for book-math-10.
 * Uses the same ids as the live KB catalog. Title-only lessons keep empty objectives.
 */
export function buildNccdSem1BrowserCatalog(): {
  units: NccdBrowserUnit[];
  lessons: NccdBrowserLesson[];
} {
  const units: NccdBrowserUnit[] = nccdG10MathSem1.units.map(u => {
    const lessonTitles = u.lessons.map(l => l.title_ar).join(' · ');
    return {
      id: nccdSem1UnitKbId(u.id),
      bookId: NCCD_S1_CURRICULUM_BOOK_ID,
      name: u.title_en,
      nameAr: u.title_ar,
      description: lessonTitles,
      descriptionAr: lessonTitles,
      order: u.number,
    };
  });

  const lessons: NccdBrowserLesson[] = [];
  for (const u of nccdG10MathSem1.units) {
    const unitKbId = nccdSem1UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const objectives = [...(lesson.objectives ?? [])];
      const vocabulary = [...(lesson.vocabulary ?? [])];
      const lessonKbId = nccdSem1LessonKbId(lesson.id);
      const periods = lesson.periods ?? 1;
      lessons.push({
        id: lessonKbId,
        unitId: unitKbId,
        title: lesson.title_ar,
        titleAr: lesson.title_ar,
        estimatedDuration: periods * 45,
        objectives,
        objectivesAr: [...objectives],
        keywords: [...vocabulary],
        keywordsAr: [...vocabulary],
        teacherNotes: '',
        teacherNotesAr: '',
        outcomes: objectives.map((o, i) => ({
          id: `o-nccd-s1-${lesson.id}-${i}`,
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
