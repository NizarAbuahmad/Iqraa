/**
 * Grade 10 Math — Semester 2 curriculum (NCCD teacher guide).
 * Source of truth: data/iqra_curriculum_g10_math_sem2.json
 * Units 5–8 supersede the legacy hardcoded S2 catalog entries.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g10_math_sem2.json' with { type: 'json' };

/** Book id in KB_BOOKS that this JSON supersedes. */
export const NCCD_S2_BOOK_ID = 'kb-math-10-s2';

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

export type NccdCurriculumMeta = {
  grade: string;
  grade_en: string;
  subject: string;
  subject_en: string;
  curriculum_authority: string;
  semester_covered: number;
  semester_note: string;
  source_books: string[];
  provenance: string;
  schema_version: string;
  known_gaps: string[];
};

export type NccdLesson = {
  id: string;
  order: number;
  title_ar: string;
  periods: number | null;
  objectives: string[];
  vocabulary: string[];
  type?: string;
};

export type NccdUnit = {
  id: string;
  number: number;
  title_ar: string;
  title_en: string;
  total_periods: number | null;
  /**
   * Optional "تعلمت سابقًا" concepts for the unit.
   * Absent in current JSON — reserved for a follow-up data enrichment.
   */
  prior_knowledge?: string[];
  lessons: NccdLesson[];
};

export type NccdCurriculumFile = {
  meta: NccdCurriculumMeta;
  units: NccdUnit[];
};

export const nccdG10MathSem2 = raw as NccdCurriculumFile;

/** Stable KB unit id derived from JSON unit id (e.g. u5 → kbu-math-s2-nccd-u5). */
export function nccdUnitKbId(jsonUnitId: string): string {
  return `kbu-math-s2-nccd-${jsonUnitId}`;
}

/** Stable KB lesson id derived from JSON lesson id (e.g. u5_l3 → kbl-math-s2-nccd-u5_l3). */
export function nccdLessonKbId(jsonLessonId: string): string {
  return `kbl-math-s2-nccd-${jsonLessonId}`;
}

/** Default demo lesson: تركيب الاقترانات (unit 5, lesson 3). */
export const NCCD_DEFAULT_LESSON_KB_ID = nccdLessonKbId('u5_l3');

/**
 * Map the NCCD JSON into KB units + lessons for book kb-math-10-s2.
 * Arabic strings are copied byte-for-byte from the JSON.
 */
export function buildNccdSem2Catalog(): { units: NccdKbUnit[]; lessons: NccdKbLesson[] } {
  const units: NccdKbUnit[] = nccdG10MathSem2.units.map(u => ({
    id: nccdUnitKbId(u.id),
    bookId: NCCD_S2_BOOK_ID,
    order: u.number,
    titleAr: u.title_ar,
    titleEn: u.title_en,
  }));

  const lessons: NccdKbLesson[] = [];
  for (const u of nccdG10MathSem2.units) {
    const unitKbId = nccdUnitKbId(u.id);
    for (const lesson of u.lessons) {
      const vocab = lesson.vocabulary ?? [];
      const objectives = lesson.objectives ?? [];
      lessons.push({
        id: nccdLessonKbId(lesson.id),
        unitId: unitKbId,
        order: lesson.order,
        titleAr: lesson.title_ar,
        // JSON has no per-lesson English title — keep Arabic for EN UI too.
        titleEn: lesson.title_ar,
        summaryAr: objectives.length
          ? objectives.join('؛ ')
          : `درس «${lesson.title_ar}» من وحدة «${u.title_ar}».`,
        summaryEn: objectives.length
          ? objectives.join('; ')
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

/** Look up a JSON lesson by mapped KB lesson id. */
export function findNccdLessonByKbId(kbLessonId: string): NccdLesson | null {
  const prefix = 'kbl-math-s2-nccd-';
  if (!kbLessonId.startsWith(prefix)) return null;
  const jsonId = kbLessonId.slice(prefix.length);
  for (const u of nccdG10MathSem2.units) {
    const hit = u.lessons.find(l => l.id === jsonId);
    if (hit) return hit;
  }
  return null;
}

/** Look up JSON unit that owns a mapped KB lesson id. */
export function findNccdUnitByLessonKbId(lessonKbId: string): NccdUnit | null {
  const prefix = 'kbl-math-s2-nccd-';
  if (!lessonKbId.startsWith(prefix)) return null;
  const jsonId = lessonKbId.slice(prefix.length);
  for (const u of nccdG10MathSem2.units) {
    if (u.lessons.some(l => l.id === jsonId)) return u;
  }
  return null;
}

/** Curriculum-browser book id for Math G10 Semester 2 (matches curriculumData BOOKS). */
export const NCCD_S2_CURRICULUM_BOOK_ID = 'book-math-10-s2';

/** Shape compatible with Unit / Lesson in curriculumData.ts (avoids circular import). */
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
 * Map NCCD JSON into curriculum-browser Unit/Lesson rows for book-math-10-s2.
 * Uses the same ids as the live KB catalog so picker and browser stay aligned.
 * Arabic strings are copied byte-for-byte from the JSON.
 */
export function buildNccdSem2BrowserCatalog(): {
  units: NccdBrowserUnit[];
  lessons: NccdBrowserLesson[];
} {
  const units: NccdBrowserUnit[] = nccdG10MathSem2.units.map(u => {
    const lessonTitles = u.lessons.map(l => l.title_ar).join(' · ');
    return {
      id: nccdUnitKbId(u.id),
      bookId: NCCD_S2_CURRICULUM_BOOK_ID,
      name: u.title_en,
      nameAr: u.title_ar,
      description: lessonTitles,
      descriptionAr: lessonTitles,
      order: u.number,
    };
  });

  const lessons: NccdBrowserLesson[] = [];
  for (const u of nccdG10MathSem2.units) {
    const unitKbId = nccdUnitKbId(u.id);
    for (const lesson of u.lessons) {
      const objectives = [...(lesson.objectives ?? [])];
      const vocabulary = [...(lesson.vocabulary ?? [])];
      const lessonKbId = nccdLessonKbId(lesson.id);
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
          id: `o-nccd-${lesson.id}-${i}`,
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
