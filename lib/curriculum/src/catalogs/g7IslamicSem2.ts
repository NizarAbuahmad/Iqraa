/**
 * Grade 7 Islamic Education (التربية الإسلامية) — Semester 2 curriculum (NCCD).
 * Source of truth: data/iqra_curriculum_g7_islamic_sem2.json
 *
 * Mirrors g7IslamicSem1.ts's bespoke structure. Unlike Semester 1, this
 * semester's teacher guide matches the student book title-for-title and
 * order-for-order across all four units — zero structural mismatches (see
 * the JSON's `known_gaps` for the explicit contrast with Semester 1).
 *
 * Vocabulary is Arabic-only (plain strings) and present only where the
 * student book prints a «المفردات والتراكيب» box — the two Surat Luqman
 * lessons and the five Tajweed/recitation lessons that quote a new Quranic
 * passage.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g7_islamic_sem2.json' with { type: 'json' };
import {
  lessonKbId,
  lessonKbPrefix,
  objectiveId,
  unitKbId,
  type CurriculumIdScope,
} from '../curriculumIds.ts';

/** Book id in KB_BOOKS this catalog belongs to. */
export const G7_ISLAMIC_S2_BOOK_ID = 'kb-islamic-7-s2';

export type G7IslamicSem2Lesson = {
  id: string;
  order: number;
  title_ar: string;
  title_en: string;
  main_idea_ar: string;
  periods: number | null;
  objectives: string[];
  vocabulary: string[];
};

export type G7IslamicSem2Unit = {
  id: string;
  number: number;
  title_ar: string;
  title_en: string;
  general_idea_ar: string;
  total_periods: number | null;
  data_tier: string;
  prior_knowledge: string[];
  lessons: G7IslamicSem2Lesson[];
};

export type G7IslamicSem2CurriculumFile = {
  meta: Record<string, unknown>;
  units: G7IslamicSem2Unit[];
};

export const nccdG7IslamicSem2 = raw as G7IslamicSem2CurriculumFile;

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

/** What this catalog's ids are scoped to — grade-7 gets an explicit `g7-` id segment. */
const SCOPE: CurriculumIdScope = { gradeId: 'grade-7', subject: 'islamic', semester: 2 };

/** Stable KB unit id (e.g. u1 → kbu-g7-islamic-s2-nccd-u1). */
export function g7IslamicSem2UnitKbId(jsonUnitId: string): string {
  return unitKbId(SCOPE, jsonUnitId);
}

/** Stable KB lesson id (e.g. u1_l1 → kbl-g7-islamic-s2-nccd-u1_l1). */
export function g7IslamicSem2LessonKbId(jsonLessonId: string): string {
  return lessonKbId(SCOPE, jsonLessonId);
}

/** Look up a JSON lesson by mapped KB lesson id. */
export function findG7IslamicSem2LessonByKbId(kbLessonId: string): G7IslamicSem2Lesson | null {
  const prefix = lessonKbPrefix(SCOPE);
  if (!kbLessonId.startsWith(prefix)) return null;
  const jsonId = kbLessonId.slice(prefix.length);
  for (const u of nccdG7IslamicSem2.units) {
    const hit = u.lessons.find(l => l.id === jsonId);
    if (hit) return hit;
  }
  return null;
}

/**
 * Map the Islamic Education JSON into KB units + lessons for book
 * kb-islamic-7-s2. Arabic strings are copied byte-for-byte from the JSON
 * (which copies the student book).
 */
export function buildG7IslamicSem2Catalog(): { units: ArabicKbUnit[]; lessons: ArabicKbLesson[] } {
  const units: ArabicKbUnit[] = nccdG7IslamicSem2.units.map(u => ({
    id: g7IslamicSem2UnitKbId(u.id),
    bookId: G7_ISLAMIC_S2_BOOK_ID,
    order: u.number,
    titleAr: u.title_ar,
    titleEn: u.title_en,
  }));

  const lessons: ArabicKbLesson[] = [];
  for (const u of nccdG7IslamicSem2.units) {
    const unitId = g7IslamicSem2UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const vocab = lesson.vocabulary ?? [];
      const objectives = lesson.objectives ?? [];
      lessons.push({
        id: g7IslamicSem2LessonKbId(lesson.id),
        unitId,
        order: lesson.order,
        titleAr: lesson.title_ar,
        titleEn: lesson.title_en,
        summaryAr: objectives.length
          ? objectives.join('؛ ')
          : `درس «${lesson.title_ar}» من وحدة «${u.title_ar}».`,
        summaryEn: objectives.length
          ? objectives.join('; ')
          : `Lesson “${lesson.title_en}” from unit “${u.title_en}”.`,
        keyConceptsAr: [...vocab],
        keyConceptsEn: [...vocab],
        keyTerms: vocab.map(v => ({ ar: v, en: v, definitionAr: '', definitionEn: '' })),
        objectives: [...objectives],
        periods: lesson.periods ?? null,
      });
    }
  }

  return { units, lessons };
}

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const G7_ISLAMIC_S2_CURRICULUM_BOOK_ID = 'book-islamic-7-s2';

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
 * Map the Islamic Education JSON into curriculum-browser Unit/Lesson rows for
 * book-islamic-7-s2. Same ids as the KB catalog above, so a lesson picked in
 * the browser and the same lesson pulled from the KB agree.
 *
 * Every lesson has real periods this semester, so the `?? 1` fallback in
 * estimatedDuration never actually fires — kept only for type-shape parity.
 */
export function buildG7IslamicSem2BrowserCatalog(): {
  units: ArabicBrowserUnit[];
  lessons: ArabicBrowserLesson[];
} {
  const units: ArabicBrowserUnit[] = nccdG7IslamicSem2.units.map(u => {
    const lessonTitles = u.lessons.map(l => l.title_ar).join(' · ');
    return {
      id: g7IslamicSem2UnitKbId(u.id),
      bookId: G7_ISLAMIC_S2_CURRICULUM_BOOK_ID,
      name: u.title_en,
      nameAr: u.title_ar,
      description: lessonTitles,
      descriptionAr: lessonTitles,
      order: u.number,
    };
  });

  const lessons: ArabicBrowserLesson[] = [];
  for (const u of nccdG7IslamicSem2.units) {
    const unitId = g7IslamicSem2UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const objectives = [...(lesson.objectives ?? [])];
      const vocabulary = [...(lesson.vocabulary ?? [])];
      const lessonId = g7IslamicSem2LessonKbId(lesson.id);
      lessons.push({
        id: lessonId,
        unitId,
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
          lessonId,
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
