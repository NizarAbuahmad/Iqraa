/**
 * Grade 9 Math — Semester 1 curriculum (NCCD).
 * Source of truth: data/iqra_curriculum_g9_math_sem1.json
 *
 * Two data tiers (see unit.data_tier), same vocabulary as g10MathSem1.ts:
 *  • Unit 1: lesson-level objectives/vocabulary/periods (teacher guide, partial —
 *    the Drive text extraction that produced the source JSON cut off mid-guide,
 *    see the JSON's own meta.known_gaps).
 *  • Units 2–4: title-only lessons, titles from the student book's own table of
 *    contents; no lesson-level content exists to carry yet.
 *
 * Mirrors g10MathSem1.ts's shape deliberately — same field names, same builder
 * functions — so a caller that already knows the Grade 10 catalog needs nothing
 * new to consume this one. The only difference is the id scope (grade-9 instead
 * of the implicit grade-10), which curriculumIds.ts's CurriculumIdScope carries.
 */

import raw from '../data/iqra_curriculum_g9_math_sem1.json' with { type: 'json' };
import {
  lessonKbId,
  lessonKbPrefix,
  objectiveId,
  unitKbId,
  unitKbPrefix,
  type CurriculumIdScope,
} from '../curriculumIds.ts';

/** Curriculum-browser book id for Math G9 Semester 1. */
export const G9_MATH_S1_CURRICULUM_BOOK_ID = 'book-math-9-s1';

/** Knowledge-base book id for Math G9 Semester 1 — KB_BOOKS entry in knowledgeBase.ts. */
export const G9_MATH_S1_KB_BOOK_ID = 'kb-math-9-s1';

export type G9MathSem1DataTier =
  | 'lesson-level (teacher guide + student book)'
  | 'unit-level only (student book)';

export type G9MathSem1Lesson = {
  id: string;
  order: number;
  title_ar: string;
  periods: number | null;
  objectives: string[];
  vocabulary: string[];
  type?: string;
};

export type G9MathSem1Unit = {
  id: string;
  number: number;
  title_ar: string;
  title_en: string;
  data_tier: G9MathSem1DataTier | string;
  total_periods: number | null;
  prior_knowledge?: string[];
  lessons: G9MathSem1Lesson[];
  pacing_source?: string;
};

export type G9MathSem1CurriculumFile = {
  meta: Record<string, unknown>;
  units: G9MathSem1Unit[];
};

export const nccdG9MathSem1 = raw as G9MathSem1CurriculumFile;

/** What this catalog's ids are scoped to — grade-9 gets an explicit `g9-` id segment. */
const SCOPE: CurriculumIdScope = { gradeId: 'grade-9', subject: 'math', semester: 1 };

/** Stable KB unit id (e.g. u1 → kbu-g9-math-s1-nccd-u1). */
export function g9MathSem1UnitKbId(jsonUnitId: string): string {
  return unitKbId(SCOPE, jsonUnitId);
}

/** Stable KB lesson id (e.g. u1_l1 → kbl-g9-math-s1-nccd-u1_l1). */
export function g9MathSem1LessonKbId(jsonLessonId: string): string {
  return lessonKbId(SCOPE, jsonLessonId);
}

export function isG9MathSem1TitleOnlyTier(dataTier: string | undefined): boolean {
  return typeof dataTier === 'string' && dataTier.startsWith('unit-level only');
}

/** True when a KB/browser unit id is a Sem1 title-only (units 2–4) unit. */
export function isG9MathSem1TitleOnlyUnit(unitKbId: string): boolean {
  const prefix = unitKbPrefix(SCOPE);
  if (!unitKbId.startsWith(prefix)) return false;
  const jsonId = unitKbId.slice(prefix.length);
  const unit = nccdG9MathSem1.units.find(u => u.id === jsonId);
  return !!unit && isG9MathSem1TitleOnlyTier(unit.data_tier);
}

/** True when a KB/browser lesson id belongs to a Sem1 title-only unit. */
export function isG9MathSem1TitleOnlyLesson(lessonKbId: string): boolean {
  const unit = findG9MathSem1UnitByLessonKbId(lessonKbId);
  return !!unit && isG9MathSem1TitleOnlyTier(unit.data_tier);
}

/** Look up JSON unit by mapped KB unit id. */
export function findG9MathSem1UnitByKbId(unitKbId: string): G9MathSem1Unit | null {
  const prefix = unitKbPrefix(SCOPE);
  if (!unitKbId.startsWith(prefix)) return null;
  const jsonId = unitKbId.slice(prefix.length);
  return nccdG9MathSem1.units.find(u => u.id === jsonId) ?? null;
}

/** Look up JSON unit that owns a mapped KB lesson id. */
export function findG9MathSem1UnitByLessonKbId(lessonKbId: string): G9MathSem1Unit | null {
  const prefix = lessonKbPrefix(SCOPE);
  if (!lessonKbId.startsWith(prefix)) return null;
  const jsonId = lessonKbId.slice(prefix.length);
  for (const u of nccdG9MathSem1.units) {
    if (u.lessons.some(l => l.id === jsonId)) return u;
  }
  return null;
}

/** Look up a JSON lesson by mapped KB lesson id. */
export function findG9MathSem1LessonByKbId(kbLessonId: string): G9MathSem1Lesson | null {
  const prefix = lessonKbPrefix(SCOPE);
  if (!kbLessonId.startsWith(prefix)) return null;
  const jsonId = kbLessonId.slice(prefix.length);
  for (const u of nccdG9MathSem1.units) {
    const hit = u.lessons.find(l => l.id === jsonId);
    if (hit) return hit;
  }
  return null;
}

/** Shape compatible with KBUnit / KBLesson in knowledgeBase.ts */
export type G9MathSem1KbUnit = {
  id: string;
  bookId: string;
  order: number;
  titleAr: string;
  titleEn: string;
};

export type G9MathSem1KbLesson = {
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

/**
 * Map the NCCD JSON into KB units + lessons for book kb-math-9-s1.
 * Mirrors buildNccdSem1Catalog in g10MathSem1.ts exactly — same shape, same
 * title-only summary/enrichment convention, so knowledgeBase.ts's merge logic
 * needs nothing Grade-9-specific to consume this.
 */
export function buildG9MathSem1Catalog(): {
  units: G9MathSem1KbUnit[];
  lessons: G9MathSem1KbLesson[];
} {
  const units: G9MathSem1KbUnit[] = nccdG9MathSem1.units.map(u => ({
    id: g9MathSem1UnitKbId(u.id),
    bookId: G9_MATH_S1_KB_BOOK_ID,
    order: u.number,
    titleAr: u.title_ar,
    titleEn: u.title_en,
  }));

  const lessons: G9MathSem1KbLesson[] = [];
  for (const u of nccdG9MathSem1.units) {
    const unitKbId = g9MathSem1UnitKbId(u.id);
    const titleOnly = isG9MathSem1TitleOnlyTier(u.data_tier);
    for (const lesson of u.lessons) {
      const vocab = lesson.vocabulary ?? [];
      const objectives = lesson.objectives ?? [];
      lessons.push({
        id: g9MathSem1LessonKbId(lesson.id),
        unitId: unitKbId,
        order: lesson.order,
        titleAr: lesson.title_ar,
        titleEn: lesson.title_ar,
        summaryAr: objectives.length
          ? objectives.join('؛ ')
          : titleOnly
            ? `درس «${lesson.title_ar}» من وحدة «${u.title_ar}» (عنوان مؤكَّد — النتاجات على مستوى الوحدة).`
            : `درس «${lesson.title_ar}» من وحدة «${u.title_ar}».`,
        summaryEn: objectives.length
          ? objectives.join('; ')
          : titleOnly
            ? `Lesson "${lesson.title_ar}" from unit "${u.title_en}" (title confirmed — outcomes are unit-level).`
            : `Lesson "${lesson.title_ar}" from unit "${u.title_en}".`,
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

/** Shape compatible with Unit / Lesson in catalog.ts */
export type G9MathSem1BrowserUnit = {
  id: string;
  bookId: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  order: number;
};

export type G9MathSem1BrowserLesson = {
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
 * Map the NCCD JSON into curriculum-browser Unit/Lesson rows for book-math-9-s1.
 * Title-only lessons (units 2–4) keep empty objectives/vocabulary — mirrors
 * buildNccdSem1BrowserCatalog in g10MathSem1.ts exactly.
 */
export function buildG9MathSem1BrowserCatalog(): {
  units: G9MathSem1BrowserUnit[];
  lessons: G9MathSem1BrowserLesson[];
} {
  const units: G9MathSem1BrowserUnit[] = nccdG9MathSem1.units.map(u => {
    const lessonTitles = u.lessons.map(l => l.title_ar).join(' · ');
    return {
      id: g9MathSem1UnitKbId(u.id),
      bookId: G9_MATH_S1_CURRICULUM_BOOK_ID,
      name: u.title_en,
      nameAr: u.title_ar,
      description: lessonTitles,
      descriptionAr: lessonTitles,
      order: u.number,
    };
  });

  const lessons: G9MathSem1BrowserLesson[] = [];
  for (const u of nccdG9MathSem1.units) {
    const unitKbId = g9MathSem1UnitKbId(u.id);
    const titleOnly = isG9MathSem1TitleOnlyTier(u.data_tier);
    for (const lesson of u.lessons) {
      const objectives = [...(lesson.objectives ?? [])];
      const vocabulary = [...(lesson.vocabulary ?? [])];
      const lessonKbId = g9MathSem1LessonKbId(lesson.id);
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
        teacherNotesAr: titleOnly
          ? `عنوان مؤكَّد من فهرس كتاب الطالب — لا نتاجات درس متاحة بعد.`
          : '',
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
