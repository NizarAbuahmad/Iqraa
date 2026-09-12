/**
 * Grade 7 Math — Semester 1 curriculum (NCCD).
 * Source of truth: data/iqra_curriculum_g7_math_sem1.json
 *
 * Mirrors g8MathSem1.ts's shape deliberately — same field names, same
 * builder functions, same `unitLevel: true` scoping (grade-7 math gets an
 * explicit `g7-` id segment via curriculumIds.ts, same as grade-8/9/10 math).
 */

import raw from '../data/iqra_curriculum_g7_math_sem1.json' with { type: 'json' };
import {
  lessonKbId,
  lessonKbPrefix,
  objectiveId,
  unitKbId,
  unitKbPrefix,
  type CurriculumIdScope,
} from '../curriculumIds.ts';

/** Curriculum-browser book id for Math G7 Semester 1. */
export const G7_MATH_S1_CURRICULUM_BOOK_ID = 'book-math-7-s1';

/** Knowledge-base book id for Math G7 Semester 1 — KB_BOOKS entry in knowledgeBase.ts. */
export const G7_MATH_S1_KB_BOOK_ID = 'kb-math-7-s1';

export type G7MathSem1Lesson = {
  id: string;
  order: number;
  title_ar: string;
  main_idea_ar: string;
  periods: number | null;
  objectives: string[];
  vocabulary: string[];
};

export type G7MathSem1Unit = {
  id: string;
  number: number;
  title_ar: string;
  title_en: string;
  data_tier: string;
  total_periods: number | null;
  prior_knowledge?: string[];
  lessons: G7MathSem1Lesson[];
};

export type G7MathSem1CurriculumFile = {
  meta: Record<string, unknown>;
  units: G7MathSem1Unit[];
};

export const nccdG7MathSem1 = raw as G7MathSem1CurriculumFile;

/** What this catalog's ids are scoped to — grade-7 gets an explicit `g7-` id segment. */
const SCOPE: CurriculumIdScope = { gradeId: 'grade-7', subject: 'math', semester: 1 };

/** Stable KB unit id (e.g. u1 → kbu-g7-math-s1-nccd-u1). */
export function g7MathSem1UnitKbId(jsonUnitId: string): string {
  return unitKbId(SCOPE, jsonUnitId);
}

/** Stable KB lesson id (e.g. u1_l1 → kbl-g7-math-s1-nccd-u1_l1). */
export function g7MathSem1LessonKbId(jsonLessonId: string): string {
  return lessonKbId(SCOPE, jsonLessonId);
}

/** Look up JSON unit by mapped KB unit id. */
export function findG7MathSem1UnitByKbId(unitKbId: string): G7MathSem1Unit | null {
  const prefix = unitKbPrefix(SCOPE);
  if (!unitKbId.startsWith(prefix)) return null;
  const jsonId = unitKbId.slice(prefix.length);
  return nccdG7MathSem1.units.find(u => u.id === jsonId) ?? null;
}

/** Look up a JSON lesson by mapped KB lesson id. */
export function findG7MathSem1LessonByKbId(kbLessonId: string): G7MathSem1Lesson | null {
  const prefix = lessonKbPrefix(SCOPE);
  if (!kbLessonId.startsWith(prefix)) return null;
  const jsonId = kbLessonId.slice(prefix.length);
  for (const u of nccdG7MathSem1.units) {
    const hit = u.lessons.find(l => l.id === jsonId);
    if (hit) return hit;
  }
  return null;
}

/** Shape compatible with KBUnit / KBLesson in knowledgeBase.ts */
export type G7MathSem1KbUnit = {
  id: string;
  bookId: string;
  order: number;
  titleAr: string;
  titleEn: string;
};

export type G7MathSem1KbLesson = {
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

/** Map the NCCD JSON into KB units + lessons for book kb-math-7-s1. */
export function buildG7MathSem1Catalog(): {
  units: G7MathSem1KbUnit[];
  lessons: G7MathSem1KbLesson[];
} {
  const units: G7MathSem1KbUnit[] = nccdG7MathSem1.units.map(u => ({
    id: g7MathSem1UnitKbId(u.id),
    bookId: G7_MATH_S1_KB_BOOK_ID,
    order: u.number,
    titleAr: u.title_ar,
    titleEn: u.title_en,
  }));

  const lessons: G7MathSem1KbLesson[] = [];
  for (const u of nccdG7MathSem1.units) {
    const uKbId = g7MathSem1UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const vocab = lesson.vocabulary ?? [];
      const objectives = lesson.objectives ?? [];
      lessons.push({
        id: g7MathSem1LessonKbId(lesson.id),
        unitId: uKbId,
        order: lesson.order,
        titleAr: lesson.title_ar,
        titleEn: lesson.title_ar,
        summaryAr: lesson.main_idea_ar || objectives.join('؛ '),
        summaryEn: lesson.main_idea_ar || objectives.join('; '),
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
export type G7MathSem1BrowserUnit = {
  id: string;
  bookId: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  order: number;
};

export type G7MathSem1BrowserLesson = {
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

/** Map the NCCD JSON into curriculum-browser Unit/Lesson rows for book-math-7-s1. */
export function buildG7MathSem1BrowserCatalog(): {
  units: G7MathSem1BrowserUnit[];
  lessons: G7MathSem1BrowserLesson[];
} {
  const units: G7MathSem1BrowserUnit[] = nccdG7MathSem1.units.map(u => {
    const lessonTitles = u.lessons.map(l => l.title_ar).join(' · ');
    return {
      id: g7MathSem1UnitKbId(u.id),
      bookId: G7_MATH_S1_CURRICULUM_BOOK_ID,
      name: u.title_en,
      nameAr: u.title_ar,
      description: lessonTitles,
      descriptionAr: lessonTitles,
      order: u.number,
    };
  });

  const lessons: G7MathSem1BrowserLesson[] = [];
  for (const u of nccdG7MathSem1.units) {
    const uKbId = g7MathSem1UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const objectives = [...(lesson.objectives ?? [])];
      const vocabulary = [...(lesson.vocabulary ?? [])];
      const lKbId = g7MathSem1LessonKbId(lesson.id);
      const periods = lesson.periods ?? 1;
      lessons.push({
        id: lKbId,
        unitId: uKbId,
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
          id: objectiveId(SCOPE, lesson.id, i),
          lessonId: lKbId,
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
