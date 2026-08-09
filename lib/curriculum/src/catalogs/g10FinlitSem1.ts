/**
 * Grade 10 Financial Literacy (الثقافة المالية) — Semester 1 curriculum (NCCD).
 * Source of truth: data/iqra_curriculum_g10_finlit_sem1.json
 *
 * The student book prints نتاجات التعلم and المفاهيم والمصطلحات الرئيسة in
 * every lesson opener (Arabic-first; English equivalents only where the book
 * prints them inline). No period counts — the teacher guide is unavailable.
 * Unlike chemistry, units open with guiding questions, not a general idea.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g10_finlit_sem1.json' with { type: 'json' };

/** Book id in KB_BOOKS this catalog belongs to (new subject — no legacy rows). */
export const FINLIT_S1_BOOK_ID = 'kb-finlit-10-s1';

export type FinlitSem1Vocab = { ar: string; en: string };

export type FinlitSem1Lesson = {
  id: string;
  order: number;
  type?: string;
  title_ar: string;
  title_en: string;
  main_idea_ar: string;
  periods: number | null;
  objectives: string[];
  vocabulary: FinlitSem1Vocab[];
};

export type FinlitSem1Unit = {
  id: string;
  number: number;
  title_ar: string;
  title_en: string;
  general_idea_ar: string;
  total_periods: number | null;
  lessons: FinlitSem1Lesson[];
};

export type FinlitSem1CurriculumFile = {
  meta: Record<string, unknown>;
  units: FinlitSem1Unit[];
};

export const nccdG10FinlitSem1 = raw as FinlitSem1CurriculumFile;

/** Shape compatible with KBUnit / KBLesson in knowledgeBase.ts */
type FinlitKbUnit = {
  id: string;
  bookId: string;
  order: number;
  titleAr: string;
  titleEn: string;
};

type FinlitKbLesson = {
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

/** Stable KB unit id (e.g. u1 → kbu-finlit-s1-nccd-u1). */
export function finlitSem1UnitKbId(jsonUnitId: string): string {
  return `kbu-finlit-s1-nccd-${jsonUnitId}`;
}

/** Stable KB lesson id (e.g. u1_l1 → kbl-finlit-s1-nccd-u1_l1). */
export function finlitSem1LessonKbId(jsonLessonId: string): string {
  return `kbl-finlit-s1-nccd-${jsonLessonId}`;
}

/** Look up a JSON lesson by mapped KB lesson id. */
export function findFinlitSem1LessonByKbId(kbLessonId: string): FinlitSem1Lesson | null {
  const prefix = 'kbl-finlit-s1-nccd-';
  if (!kbLessonId.startsWith(prefix)) return null;
  const jsonId = kbLessonId.slice(prefix.length);
  for (const u of nccdG10FinlitSem1.units) {
    const hit = u.lessons.find(l => l.id === jsonId);
    if (hit) return hit;
  }
  return null;
}

/**
 * Map the financial-literacy JSON into KB units + lessons for
 * book kb-finlit-10-s1. Arabic strings are copied byte-for-byte from the
 * JSON (which copies the student book). Where the book prints no English
 * equivalent for a term, keyConceptsEn falls back to the Arabic term.
 */
export function buildFinlitSem1Catalog(): { units: FinlitKbUnit[]; lessons: FinlitKbLesson[] } {
  const units: FinlitKbUnit[] = nccdG10FinlitSem1.units.map(u => ({
    id: finlitSem1UnitKbId(u.id),
    bookId: FINLIT_S1_BOOK_ID,
    order: u.number,
    titleAr: u.title_ar,
    titleEn: u.title_en,
  }));

  const lessons: FinlitKbLesson[] = [];
  for (const u of nccdG10FinlitSem1.units) {
    const unitKbId = finlitSem1UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const vocab = lesson.vocabulary ?? [];
      const objectives = lesson.objectives ?? [];
      lessons.push({
        id: finlitSem1LessonKbId(lesson.id),
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
export const FINLIT_S1_CURRICULUM_BOOK_ID = 'book-finlit-10';

/** Shape compatible with Unit / Lesson in curriculumData.ts */
type FinlitBrowserUnit = {
  id: string;
  bookId: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  order: number;
};

type FinlitBrowserLesson = {
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
 * Map the financial-literacy JSON into curriculum-browser Unit/Lesson rows for
 * book-finlit-10. Uses the same ids as the KB catalog above, so a lesson picked
 * in the browser and the same lesson pulled from the KB agree.
 *
 * The student book prints no حصص counts (periods is null for every lesson) and
 * no teacher guide exists, so estimatedDuration falls back to one 45-minute
 * period — same convention as the math catalogs.
 */
export function buildFinlitSem1BrowserCatalog(): {
  units: FinlitBrowserUnit[];
  lessons: FinlitBrowserLesson[];
} {
  const units: FinlitBrowserUnit[] = nccdG10FinlitSem1.units.map(u => {
    const lessonTitles = u.lessons.map(l => l.title_ar).join(' · ');
    return {
      id: finlitSem1UnitKbId(u.id),
      bookId: FINLIT_S1_CURRICULUM_BOOK_ID,
      name: u.title_en,
      nameAr: u.title_ar,
      description: lessonTitles,
      descriptionAr: lessonTitles,
      order: u.number,
    };
  });

  const lessons: FinlitBrowserLesson[] = [];
  for (const u of nccdG10FinlitSem1.units) {
    const unitKbId = finlitSem1UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const objectives = [...(lesson.objectives ?? [])];
      const vocabulary = (lesson.vocabulary ?? []).map(v => v.ar);
      const lessonKbId = finlitSem1LessonKbId(lesson.id);
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
          id: `o-finlit-s1-${lesson.id}-${i}`,
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
