/**
 * Grade 7 Islamic Education (التربية الإسلامية) — Semester 1 curriculum (NCCD).
 * Source of truth: data/iqra_curriculum_g7_islamic_sem1.json
 *
 * Mirrors g8IslamicSem1.ts's bespoke structure deliberately (NOT
 * makeNccdCatalog) — same field names, same builder functions, scoped to
 * grade-7 instead of grade-8.
 *
 * **Lesson titles and main ideas: the student book.** «الفكرةُ الرَّئيسَةُ»
 * box on each lesson opener, copied verbatim.
 *
 * **Objectives and periods: the teacher guide's four unit-plan tables**,
 * matched by title/content. Units 2-4 match the book title-for-title and
 * order-for-order (18/18 lessons). Unit 1 has a genuine structural gap:
 * u1_l1 («من مصادر التشريع الإسلامي: القرآن الكريم») has no counterpart
 * anywhere in the guide, which instead covers an unrelated topic («السُّنّة
 * النبوية الشريفة») not present in the book — u1_l1's objectives are empty
 * and periods null rather than guessed; the guide-only lesson is unused.
 * See the JSON's `known_gaps` for the full accounting.
 *
 * Vocabulary is Arabic-only (plain strings, not {ar,en} pairs) and present
 * only where the student book prints a «المفردات والتراكيب» box — the four
 * Surat Al-Mulk lessons, the four Tajweed/recitation lessons, and (unlike
 * the Grade 8 precedent) one hadith lesson, u2_l2.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g7_islamic_sem1.json' with { type: 'json' };
import {
  lessonKbId,
  lessonKbPrefix,
  objectiveId,
  unitKbId,
  type CurriculumIdScope,
} from '../curriculumIds.ts';

/** Book id in KB_BOOKS this catalog belongs to. */
export const G7_ISLAMIC_S1_BOOK_ID = 'kb-islamic-7-s1';

export type G7IslamicSem1Lesson = {
  id: string;
  order: number;
  title_ar: string;
  title_en: string;
  main_idea_ar: string;
  periods: number | null;
  objectives: string[];
  vocabulary: string[];
};

export type G7IslamicSem1Unit = {
  id: string;
  number: number;
  title_ar: string;
  title_en: string;
  general_idea_ar: string;
  total_periods: number | null;
  data_tier: string;
  prior_knowledge: string[];
  lessons: G7IslamicSem1Lesson[];
};

export type G7IslamicSem1CurriculumFile = {
  meta: Record<string, unknown>;
  units: G7IslamicSem1Unit[];
};

export const nccdG7IslamicSem1 = raw as G7IslamicSem1CurriculumFile;

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
const SCOPE: CurriculumIdScope = { gradeId: 'grade-7', subject: 'islamic', semester: 1 };

/** Stable KB unit id (e.g. u1 → kbu-g7-islamic-s1-nccd-u1). */
export function g7IslamicSem1UnitKbId(jsonUnitId: string): string {
  return unitKbId(SCOPE, jsonUnitId);
}

/** Stable KB lesson id (e.g. u1_l1 → kbl-g7-islamic-s1-nccd-u1_l1). */
export function g7IslamicSem1LessonKbId(jsonLessonId: string): string {
  return lessonKbId(SCOPE, jsonLessonId);
}

/** Look up a JSON lesson by mapped KB lesson id. */
export function findG7IslamicSem1LessonByKbId(kbLessonId: string): G7IslamicSem1Lesson | null {
  const prefix = lessonKbPrefix(SCOPE);
  if (!kbLessonId.startsWith(prefix)) return null;
  const jsonId = kbLessonId.slice(prefix.length);
  for (const u of nccdG7IslamicSem1.units) {
    const hit = u.lessons.find(l => l.id === jsonId);
    if (hit) return hit;
  }
  return null;
}

/**
 * Map the Islamic Education JSON into KB units + lessons for book
 * kb-islamic-7-s1. Arabic strings are copied byte-for-byte from the JSON
 * (which copies the student book).
 */
export function buildG7IslamicSem1Catalog(): { units: ArabicKbUnit[]; lessons: ArabicKbLesson[] } {
  const units: ArabicKbUnit[] = nccdG7IslamicSem1.units.map(u => ({
    id: g7IslamicSem1UnitKbId(u.id),
    bookId: G7_ISLAMIC_S1_BOOK_ID,
    order: u.number,
    titleAr: u.title_ar,
    titleEn: u.title_en,
  }));

  const lessons: ArabicKbLesson[] = [];
  for (const u of nccdG7IslamicSem1.units) {
    const unitId = g7IslamicSem1UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const vocab = lesson.vocabulary ?? [];
      const objectives = lesson.objectives ?? [];
      lessons.push({
        id: g7IslamicSem1LessonKbId(lesson.id),
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
export const G7_ISLAMIC_S1_CURRICULUM_BOOK_ID = 'book-islamic-7-s1';

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
 * book-islamic-7-s1. Same ids as the KB catalog above, so a lesson picked in
 * the browser and the same lesson pulled from the KB agree.
 *
 * `periods` is null only for u1_l1 (the one genuine guide gap), so the `?? 1`
 * fallback in estimatedDuration fires for exactly that lesson.
 */
export function buildG7IslamicSem1BrowserCatalog(): {
  units: ArabicBrowserUnit[];
  lessons: ArabicBrowserLesson[];
} {
  const units: ArabicBrowserUnit[] = nccdG7IslamicSem1.units.map(u => {
    const lessonTitles = u.lessons.map(l => l.title_ar).join(' · ');
    return {
      id: g7IslamicSem1UnitKbId(u.id),
      bookId: G7_ISLAMIC_S1_CURRICULUM_BOOK_ID,
      name: u.title_en,
      nameAr: u.title_ar,
      description: lessonTitles,
      descriptionAr: lessonTitles,
      order: u.number,
    };
  });

  const lessons: ArabicBrowserLesson[] = [];
  for (const u of nccdG7IslamicSem1.units) {
    const unitId = g7IslamicSem1UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const objectives = [...(lesson.objectives ?? [])];
      const vocabulary = [...(lesson.vocabulary ?? [])];
      const lessonId = g7IslamicSem1LessonKbId(lesson.id);
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
