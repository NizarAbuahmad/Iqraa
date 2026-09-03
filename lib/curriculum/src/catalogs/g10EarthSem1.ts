/**
 * Grade 10 Earth and Environmental Science — Semester 1 curriculum (NCCD
 * student book).
 * Source of truth: data/iqra_curriculum_g10_earth_sem1.json
 *
 * Like physics and chemistry, the student book prints الفكرة الرئيسة,
 * نتاجات التعلم and bilingual المفاهيم والمصطلحات in every lesson opener, so
 * every lesson here is lesson-level data copied from the book. Unlike
 * physics S1, no period counts are available at all, not even from the
 * teacher guide: `earth-s1-teacher-guide` and `earth-s2-teacher-guide` both
 * extract with the definite article transposed and neither extraction was
 * kept, so every `periods` is null and every `total_periods` with it. Both
 * PDFs are intact in R2 and need a better extractor or OCR.
 *
 * Unit numbering is continuous across the year (1, 2 here; 3, 4, 5 in
 * Semester 2) — unlike physics, which has a gap at unit 3.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g10_earth_sem1.json' with { type: 'json' };
import {
  lessonKbId,
  lessonKbPrefix,
  objectiveId,
  unitKbId,
  type CurriculumIdScope,
} from '../curriculumIds.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const EARTH_S1_BOOK_ID = 'kb-earth-10-s1';

export type EarthSem1Vocab = { ar: string; en: string };

export type EarthSem1Lesson = {
  id: string;
  order: number;
  type?: string;
  title_ar: string;
  title_en: string;
  main_idea_ar: string;
  periods: number | null;
  objectives: string[];
  vocabulary: EarthSem1Vocab[];
};

export type EarthSem1Unit = {
  id: string;
  number: number;
  title_ar: string;
  title_en: string;
  general_idea_ar: string;
  total_periods: number | null;
  prior_knowledge: string[];
  lessons: EarthSem1Lesson[];
};

export type EarthSem1CurriculumFile = {
  meta: Record<string, unknown>;
  units: EarthSem1Unit[];
};

export const nccdG10EarthSem1 = raw as EarthSem1CurriculumFile;

/** Shape compatible with KBUnit / KBLesson in knowledgeBase.ts */
type EarthKbUnit = {
  id: string;
  bookId: string;
  order: number;
  titleAr: string;
  titleEn: string;
};

type EarthKbLesson = {
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

const SCOPE: CurriculumIdScope = { gradeId: 'grade-10', subject: 'earth-science', semester: 1 };

/** Stable KB unit id (e.g. u1 → kbu-earth-science-s1-nccd-u1). */
export function earthSem1UnitKbId(jsonUnitId: string): string {
  return unitKbId(SCOPE, jsonUnitId);
}

/** Stable KB lesson id (e.g. u1_l1 → kbl-earth-science-s1-nccd-u1_l1). */
export function earthSem1LessonKbId(jsonLessonId: string): string {
  return lessonKbId(SCOPE, jsonLessonId);
}

/** Look up a JSON lesson by mapped KB lesson id. */
export function findEarthSem1LessonByKbId(kbLessonId: string): EarthSem1Lesson | null {
  const prefix = lessonKbPrefix(SCOPE);
  if (!kbLessonId.startsWith(prefix)) return null;
  const jsonId = kbLessonId.slice(prefix.length);
  for (const u of nccdG10EarthSem1.units) {
    const hit = u.lessons.find(l => l.id === jsonId);
    if (hit) return hit;
  }
  return null;
}

/**
 * Map the earth-science JSON into KB units + lessons for book kb-earth-10-s1.
 * Arabic strings are copied byte-for-byte from the JSON (which copies the
 * student book).
 */
export function buildEarthSem1Catalog(): { units: EarthKbUnit[]; lessons: EarthKbLesson[] } {
  const units: EarthKbUnit[] = nccdG10EarthSem1.units.map(u => ({
    id: earthSem1UnitKbId(u.id),
    bookId: EARTH_S1_BOOK_ID,
    order: u.number,
    titleAr: u.title_ar,
    titleEn: u.title_en,
  }));

  const lessons: EarthKbLesson[] = [];
  for (const u of nccdG10EarthSem1.units) {
    const uKbId = earthSem1UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const vocab = lesson.vocabulary ?? [];
      const objectives = lesson.objectives ?? [];
      lessons.push({
        id: earthSem1LessonKbId(lesson.id),
        unitId: uKbId,
        order: lesson.order,
        titleAr: lesson.title_ar,
        titleEn: lesson.title_en,
        summaryAr: lesson.main_idea_ar || `درس «${lesson.title_ar}» من وحدة «${u.title_ar}».`,
        summaryEn: lesson.main_idea_ar || `Lesson “${lesson.title_en}” from unit “${u.title_en}”.`,
        keyConceptsAr: vocab.map(v => v.ar),
        keyConceptsEn: vocab.map(v => v.en),
        keyTerms: vocab.map(v => ({
          ar: v.ar,
          en: v.en,
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
export const EARTH_S1_CURRICULUM_BOOK_ID = 'book-earth-10-s1';

/** Shape compatible with Unit / Lesson in curriculumData.ts */
type EarthBrowserUnit = {
  id: string;
  bookId: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  order: number;
};

type EarthBrowserLesson = {
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
 * Map the earth-science S1 JSON into curriculum-browser Unit/Lesson rows for
 * book-earth-10-s1.
 *
 * Supersedes nothing: earth science had no hand-written rows to replace, so
 * there are no authored Bloom's levels to merge back in. Every outcome is a
 * defaulted `'Understand'`, carrying the `o-nccd-` prefix that objectives.ts
 * reads to stamp `bloomsSource: 'defaulted'`.
 */
export function buildEarthSem1BrowserCatalog(): {
  units: EarthBrowserUnit[];
  lessons: EarthBrowserLesson[];
} {
  const units: EarthBrowserUnit[] = nccdG10EarthSem1.units.map(u => {
    const lessonTitles = u.lessons.map(l => l.title_ar).join(' · ');
    return {
      id: earthSem1UnitKbId(u.id),
      bookId: EARTH_S1_CURRICULUM_BOOK_ID,
      name: u.title_en,
      nameAr: u.title_ar,
      description: lessonTitles,
      descriptionAr: lessonTitles,
      order: u.number,
    };
  });

  const lessons: EarthBrowserLesson[] = [];
  for (const u of nccdG10EarthSem1.units) {
    const uKbId = earthSem1UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const objectives = [...(lesson.objectives ?? [])];
      const vocabulary = (lesson.vocabulary ?? []).map(v => v.ar);
      const lKbId = earthSem1LessonKbId(lesson.id);
      lessons.push({
        id: lKbId,
        unitId: uKbId,
        title: lesson.title_en,
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
