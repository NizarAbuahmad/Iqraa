/**
 * Grade 9 Math — Semester 2 curriculum (NCCD).
 * Source of truth: data/iqra_curriculum_g9_math_sem2.json
 *
 * Every unit is title-only — no teacher guide for this semester has reached
 * this session (see the JSON's own meta.known_gaps). Units/lessons come from
 * the official exercise book's own table of contents only.
 *
 * Mirrors g9MathSem1.ts's shape deliberately, same as that file mirrors
 * g10MathSem1.ts — one vocabulary across every NCCD catalog in this package.
 */

import raw from '../data/iqra_curriculum_g9_math_sem2.json' with { type: 'json' };
import {
  lessonKbId,
  lessonKbPrefix,
  objectiveId,
  unitKbId,
  unitKbPrefix,
  type CurriculumIdScope,
} from '../curriculumIds.ts';

/** Curriculum-browser book id for Math G9 Semester 2. */
export const G9_MATH_S2_CURRICULUM_BOOK_ID = 'book-math-9-s2';

export type G9MathSem2DataTier =
  | 'lesson-level (teacher guide + student book)'
  | 'unit-level only (exercise book)';

export type G9MathSem2Lesson = {
  id: string;
  order: number;
  title_ar: string;
  periods: number | null;
  objectives: string[];
  vocabulary: string[];
  type?: string;
};

export type G9MathSem2Unit = {
  id: string;
  number: number;
  title_ar: string;
  title_en: string;
  data_tier: G9MathSem2DataTier | string;
  total_periods: number | null;
  prior_knowledge?: string[];
  lessons: G9MathSem2Lesson[];
};

export type G9MathSem2CurriculumFile = {
  meta: Record<string, unknown>;
  units: G9MathSem2Unit[];
};

export const nccdG9MathSem2 = raw as G9MathSem2CurriculumFile;

const SCOPE: CurriculumIdScope = { gradeId: 'grade-9', subject: 'math', semester: 2 };

export function g9MathSem2UnitKbId(jsonUnitId: string): string {
  return unitKbId(SCOPE, jsonUnitId);
}

export function g9MathSem2LessonKbId(jsonLessonId: string): string {
  return lessonKbId(SCOPE, jsonLessonId);
}

export function isG9MathSem2TitleOnlyTier(dataTier: string | undefined): boolean {
  return typeof dataTier === 'string' && dataTier.startsWith('unit-level only');
}

export function isG9MathSem2TitleOnlyUnit(unitKbId: string): boolean {
  const prefix = unitKbPrefix(SCOPE);
  if (!unitKbId.startsWith(prefix)) return false;
  const jsonId = unitKbId.slice(prefix.length);
  const unit = nccdG9MathSem2.units.find(u => u.id === jsonId);
  return !!unit && isG9MathSem2TitleOnlyTier(unit.data_tier);
}

export function isG9MathSem2TitleOnlyLesson(lessonKbId: string): boolean {
  const unit = findG9MathSem2UnitByLessonKbId(lessonKbId);
  return !!unit && isG9MathSem2TitleOnlyTier(unit.data_tier);
}

export function findG9MathSem2UnitByLessonKbId(lessonKbId: string): G9MathSem2Unit | null {
  const prefix = lessonKbPrefix(SCOPE);
  if (!lessonKbId.startsWith(prefix)) return null;
  const jsonId = lessonKbId.slice(prefix.length);
  for (const u of nccdG9MathSem2.units) {
    if (u.lessons.some(l => l.id === jsonId)) return u;
  }
  return null;
}

export type G9MathSem2BrowserUnit = {
  id: string;
  bookId: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  order: number;
};

export type G9MathSem2BrowserLesson = {
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

/** Maps the NCCD JSON into curriculum-browser Unit/Lesson rows for book-math-9-s2. */
export function buildG9MathSem2BrowserCatalog(): {
  units: G9MathSem2BrowserUnit[];
  lessons: G9MathSem2BrowserLesson[];
} {
  const units: G9MathSem2BrowserUnit[] = nccdG9MathSem2.units.map(u => {
    const lessonTitles = u.lessons.map(l => l.title_ar).join(' · ');
    return {
      id: g9MathSem2UnitKbId(u.id),
      bookId: G9_MATH_S2_CURRICULUM_BOOK_ID,
      name: u.title_en,
      nameAr: u.title_ar,
      description: lessonTitles,
      descriptionAr: lessonTitles,
      order: u.number,
    };
  });

  const lessons: G9MathSem2BrowserLesson[] = [];
  for (const u of nccdG9MathSem2.units) {
    const unitKbId = g9MathSem2UnitKbId(u.id);
    const titleOnly = isG9MathSem2TitleOnlyTier(u.data_tier);
    for (const lesson of u.lessons) {
      const objectives = [...(lesson.objectives ?? [])];
      const vocabulary = [...(lesson.vocabulary ?? [])];
      const lessonKbId = g9MathSem2LessonKbId(lesson.id);
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
          ? `عنوان مؤكَّد من فهرس كتاب التمارين — لا نتاجات درس متاحة بعد.`
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
