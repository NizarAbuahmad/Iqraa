/**
 * Grade 10 Arabic (العربية لغتي) — Semester 2 curriculum (NCCD).
 * Source of truth: data/iqra_curriculum_g10_arabic_sem2.json
 *
 * Semester 2 carries units 6–10, continuing S1's numbering, and repeats S1's
 * shape exactly: the same five skills in the same order in every unit
 * (أستمع / أتحدّث / أقرأ / أكتب محتوًى / أبني لغتي), no حصص counts, and no
 * per-lesson term list. So `title_ar` identifies a lesson no better here than
 * it does there — «أستمعُ بانتباهٍ وتركيزٍ» is ten different lessons across the
 * two semesters. Ids do; nothing here derives a lesson from its title.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g10_arabic_sem2.json' with { type: 'json' };
import {
  lessonKbId,
  lessonKbPrefix,
  objectiveId,
  unitKbId,
  type CurriculumIdScope,
} from '../curriculumIds.ts';

/** Book id in KB_BOOKS this catalog belongs to (new subject — no legacy rows). */
export const ARABIC_S2_BOOK_ID = 'kb-arabic-10-s2';

export type ArabicSem2Vocab = { ar: string; en: string };

export type ArabicSem2Lesson = {
  id: string;
  order: number;
  title_ar: string;
  title_en: string;
  main_idea_ar: string;
  periods: number | null;
  objectives: string[];
  vocabulary: ArabicSem2Vocab[];
};

export type ArabicSem2Unit = {
  id: string;
  number: number;
  title_ar: string;
  title_en: string;
  general_idea_ar: string;
  total_periods: number | null;
  lessons: ArabicSem2Lesson[];
};

export type ArabicSem2CurriculumFile = {
  meta: Record<string, unknown>;
  units: ArabicSem2Unit[];
};

export const nccdG10ArabicSem2 = raw as ArabicSem2CurriculumFile;

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
const SCOPE: CurriculumIdScope = { gradeId: 'grade-10', subject: 'arabic', semester: 2 };

/** Stable KB unit id (e.g. u6 → kbu-arabic-s2-nccd-u6). */
export function arabicSem2UnitKbId(jsonUnitId: string): string {
  return unitKbId(SCOPE, jsonUnitId);
}

/** Stable KB lesson id (e.g. u6_l1 → kbl-arabic-s2-nccd-u6_l1). */
export function arabicSem2LessonKbId(jsonLessonId: string): string {
  return lessonKbId(SCOPE, jsonLessonId);
}

/** Look up a JSON lesson by mapped KB lesson id. */
export function findArabicSem2LessonByKbId(kbLessonId: string): ArabicSem2Lesson | null {
  const prefix = lessonKbPrefix(SCOPE);
  if (!kbLessonId.startsWith(prefix)) return null;
  const jsonId = kbLessonId.slice(prefix.length);
  for (const u of nccdG10ArabicSem2.units) {
    const hit = u.lessons.find(l => l.id === jsonId);
    if (hit) return hit;
  }
  return null;
}

/**
 * Map the Arabic JSON into KB units + lessons for book kb-arabic-10-s2.
 * Arabic strings are copied byte-for-byte from the JSON (which copies the
 * student book).
 */
export function buildArabicSem2Catalog(): { units: ArabicKbUnit[]; lessons: ArabicKbLesson[] } {
  const units: ArabicKbUnit[] = nccdG10ArabicSem2.units.map(u => ({
    id: arabicSem2UnitKbId(u.id),
    bookId: ARABIC_S2_BOOK_ID,
    order: u.number,
    titleAr: u.title_ar,
    titleEn: u.title_en,
  }));

  const lessons: ArabicKbLesson[] = [];
  for (const u of nccdG10ArabicSem2.units) {
    const unitKbId = arabicSem2UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const vocab = lesson.vocabulary ?? [];
      const objectives = lesson.objectives ?? [];
      lessons.push({
        id: arabicSem2LessonKbId(lesson.id),
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
export const ARABIC_S2_CURRICULUM_BOOK_ID = 'book-arabic-10-s2';

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
 * book-arabic-10-s2. Same ids as the KB catalog above, so a lesson picked in
 * the browser and the same lesson pulled from the KB agree.
 *
 * The student book prints no حصص counts (periods is null for every lesson), so
 * estimatedDuration falls back to one 45-minute period — same convention as
 * the math and financial-literacy catalogs.
 */
export function buildArabicSem2BrowserCatalog(): {
  units: ArabicBrowserUnit[];
  lessons: ArabicBrowserLesson[];
} {
  const units: ArabicBrowserUnit[] = nccdG10ArabicSem2.units.map(u => {
    const lessonTitles = u.lessons.map(l => l.title_ar).join(' · ');
    return {
      id: arabicSem2UnitKbId(u.id),
      bookId: ARABIC_S2_CURRICULUM_BOOK_ID,
      name: u.title_en,
      nameAr: u.title_ar,
      description: lessonTitles,
      descriptionAr: lessonTitles,
      order: u.number,
    };
  });

  const lessons: ArabicBrowserLesson[] = [];
  for (const u of nccdG10ArabicSem2.units) {
    const unitKbId = arabicSem2UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const objectives = [...(lesson.objectives ?? [])];
      const vocabulary = (lesson.vocabulary ?? []).map(v => v.ar);
      const lessonKbId = arabicSem2LessonKbId(lesson.id);
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
