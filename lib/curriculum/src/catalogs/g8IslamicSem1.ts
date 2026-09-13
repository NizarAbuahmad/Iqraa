/**
 * Grade 8 Islamic Education (التربية الإسلامية) — Semester 1 curriculum (NCCD).
 * Source of truth: data/iqra_curriculum_g8_islamic_sem1.json
 *
 * Mirrors g10IslamicSem1.ts's bespoke structure deliberately (NOT
 * makeNccdCatalog) — same field names, same builder functions, scoped to
 * grade-8 instead of the implicit grade-10.
 *
 * **Lesson titles and main ideas: the student book.** «الفكرةُ الرَّئيسَةُ»
 * box on each lesson opener, copied verbatim.
 *
 * **Objectives and periods: the teacher guide** — but matched by lesson
 * title/content, not by position, because this guide's own lesson order
 * diverges from the book's structurally, not just in wording:
 * - The guide covers Hujurat verses (1-8) as ONE 2-period lesson in its own
 *   unit 1, while the book splits that range into two lessons in two
 *   different units (u1_l2 covering 1-5, u2_l1 covering 6-8). Both book
 *   lessons carry the same guide objectives verbatim, with the guide's 2
 *   periods split 1+1.
 * - u3_l2 («من مصادر التشريع: السنة النبوية») has no matching lesson
 *   anywhere in the guide's four unit-plan tables — objectives are empty,
 *   periods null, not guessed.
 * - u1_l1 («العناية بالقرآن الكريم») matches a guide lesson titled «تدوين
 *   القرآن الكريم» by content (both describe writing/compiling/copying/
 *   printing the Qur'an), not by position — the guide places it out of
 *   sequence with the rest of its own unit 1.
 * - u3_l6 («الزكاة») is one book lesson; the guide splits it into two
 *   («أهمية الزكاة وشروط وجوبها» + «الأموال التي تجب فيها الزكاة»). Both
 *   guide lessons' objectives are merged (8 items) and periods summed (3).
 * See the JSON's `known_gaps` for the full accounting, including a guide-only
 * lesson («من مصادر التشريع: القرآن الكريم») that matches nothing in the book
 * and was not used.
 *
 * Vocabulary is Arabic-only (plain strings, not {ar,en} pairs) and present
 * only for the Qur'an-recitation lessons (سورة الحجرات and التلاوة والتجويد)
 * — the only lessons whose student-book pages print a «المفردات والتراكيب»
 * box at all.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g8_islamic_sem1.json' with { type: 'json' };
import {
  lessonKbId,
  lessonKbPrefix,
  objectiveId,
  unitKbId,
  type CurriculumIdScope,
} from '../curriculumIds.ts';

/** Book id in KB_BOOKS this catalog belongs to. */
export const G8_ISLAMIC_S1_BOOK_ID = 'kb-islamic-8-s1';

export type G8IslamicSem1Lesson = {
  id: string;
  order: number;
  title_ar: string;
  title_en: string;
  main_idea_ar: string;
  periods: number | null;
  objectives: string[];
  vocabulary: string[];
};

export type G8IslamicSem1Unit = {
  id: string;
  number: number;
  title_ar: string;
  title_en: string;
  general_idea_ar: string;
  total_periods: number | null;
  data_tier: string;
  prior_knowledge: string[];
  lessons: G8IslamicSem1Lesson[];
};

export type G8IslamicSem1CurriculumFile = {
  meta: Record<string, unknown>;
  units: G8IslamicSem1Unit[];
};

export const nccdG8IslamicSem1 = raw as G8IslamicSem1CurriculumFile;

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

/** What this catalog's ids are scoped to — grade-8 gets an explicit `g8-` id segment. */
const SCOPE: CurriculumIdScope = { gradeId: 'grade-8', subject: 'islamic', semester: 1 };

/** Stable KB unit id (e.g. u1 → kbu-g8-islamic-s1-nccd-u1). */
export function g8IslamicSem1UnitKbId(jsonUnitId: string): string {
  return unitKbId(SCOPE, jsonUnitId);
}

/** Stable KB lesson id (e.g. u1_l1 → kbl-g8-islamic-s1-nccd-u1_l1). */
export function g8IslamicSem1LessonKbId(jsonLessonId: string): string {
  return lessonKbId(SCOPE, jsonLessonId);
}

/** Look up a JSON lesson by mapped KB lesson id. */
export function findG8IslamicSem1LessonByKbId(kbLessonId: string): G8IslamicSem1Lesson | null {
  const prefix = lessonKbPrefix(SCOPE);
  if (!kbLessonId.startsWith(prefix)) return null;
  const jsonId = kbLessonId.slice(prefix.length);
  for (const u of nccdG8IslamicSem1.units) {
    const hit = u.lessons.find(l => l.id === jsonId);
    if (hit) return hit;
  }
  return null;
}

/**
 * Map the Islamic Education JSON into KB units + lessons for book
 * kb-islamic-8-s1. Arabic strings are copied byte-for-byte from the JSON
 * (which copies the student book).
 */
export function buildG8IslamicSem1Catalog(): { units: ArabicKbUnit[]; lessons: ArabicKbLesson[] } {
  const units: ArabicKbUnit[] = nccdG8IslamicSem1.units.map(u => ({
    id: g8IslamicSem1UnitKbId(u.id),
    bookId: G8_ISLAMIC_S1_BOOK_ID,
    order: u.number,
    titleAr: u.title_ar,
    titleEn: u.title_en,
  }));

  const lessons: ArabicKbLesson[] = [];
  for (const u of nccdG8IslamicSem1.units) {
    const unitId = g8IslamicSem1UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const vocab = lesson.vocabulary ?? [];
      const objectives = lesson.objectives ?? [];
      lessons.push({
        id: g8IslamicSem1LessonKbId(lesson.id),
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
export const G8_ISLAMIC_S1_CURRICULUM_BOOK_ID = 'book-islamic-8-s1';

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
 * book-islamic-8-s1. Same ids as the KB catalog above, so a lesson picked in
 * the browser and the same lesson pulled from the KB agree.
 *
 * `periods` is null only for u3_l2 (the one genuine guide gap), so the `?? 1`
 * fallback in estimatedDuration fires for exactly that lesson.
 */
export function buildG8IslamicSem1BrowserCatalog(): {
  units: ArabicBrowserUnit[];
  lessons: ArabicBrowserLesson[];
} {
  const units: ArabicBrowserUnit[] = nccdG8IslamicSem1.units.map(u => {
    const lessonTitles = u.lessons.map(l => l.title_ar).join(' · ');
    return {
      id: g8IslamicSem1UnitKbId(u.id),
      bookId: G8_ISLAMIC_S1_CURRICULUM_BOOK_ID,
      name: u.title_en,
      nameAr: u.title_ar,
      description: lessonTitles,
      descriptionAr: lessonTitles,
      order: u.number,
    };
  });

  const lessons: ArabicBrowserLesson[] = [];
  for (const u of nccdG8IslamicSem1.units) {
    const unitId = g8IslamicSem1UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const objectives = [...(lesson.objectives ?? [])];
      const vocabulary = [...(lesson.vocabulary ?? [])];
      const lessonId = g8IslamicSem1LessonKbId(lesson.id);
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
