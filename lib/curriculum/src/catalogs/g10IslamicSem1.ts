/**
 * Grade 10 Islamic Education (التربية الإسلامية) — Semester 1 curriculum (NCCD).
 * Source of truth: data/iqra_curriculum_g10_islamic_sem1.json
 *
 * Two books feed this one catalog, and it matters which field comes from which.
 *
 * **Outcomes and periods: the teacher guide.** It prints نتاجات التعلم and
 * «الزمن المقترح لتنفيذ الدرس» on every lesson page, which is why this subject
 * has real `periods` at all. They come from those lesson pages, NOT from the
 * «مخطط الوحدة» summary table — that table abbreviates (it shows 3 of «حفظ
 * اللسان»'s 6 outcomes). Its «المفاهيم» column is abbreviated the same way with
 * no second source to check against, so no vocabulary is carried at all.
 *
 * **Lesson titles: the student book**, extracted 2026-09-05 (by OCR — its text
 * layer transposes the definite article in 96% of samples). Cross-checking all
 * 24 against the guide found **five that genuinely differ**, e.g. the guide's
 * «الرِّبا وأحكامه في الفقه الإسلامي» is «موقف الشريعة الإسلاميّة من الرِّبا» in
 * the book. The book wins — it is what a teacher and student hold — and the
 * guide's wording is recorded in the data file's `known_gaps` rather than
 * erased, since the two may simply be different editions.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g10_islamic_sem1.json' with { type: 'json' };
import {
  lessonKbId,
  lessonKbPrefix,
  objectiveId,
  unitKbId,
  type CurriculumIdScope,
} from '../curriculumIds.ts';

/** Book id in KB_BOOKS this catalog belongs to (new subject — no legacy rows). */
export const ISLAMIC_S1_BOOK_ID = 'kb-islamic-10-s1';

export type IslamicSem1Vocab = { ar: string; en: string };

export type IslamicSem1Lesson = {
  id: string;
  order: number;
  title_ar: string;
  title_en: string;
  main_idea_ar: string;
  periods: number | null;
  objectives: string[];
  vocabulary: IslamicSem1Vocab[];
};

export type IslamicSem1Unit = {
  id: string;
  number: number;
  title_ar: string;
  title_en: string;
  general_idea_ar: string;
  total_periods: number | null;
  lessons: IslamicSem1Lesson[];
};

export type IslamicSem1CurriculumFile = {
  meta: Record<string, unknown>;
  units: IslamicSem1Unit[];
};

export const nccdG10IslamicSem1 = raw as IslamicSem1CurriculumFile;

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
const SCOPE: CurriculumIdScope = { gradeId: 'grade-10', subject: 'islamic', semester: 1 };

/** Stable KB unit id (e.g. u1 → kbu-islamic-s1-nccd-u1). */
export function islamicSem1UnitKbId(jsonUnitId: string): string {
  return unitKbId(SCOPE, jsonUnitId);
}

/** Stable KB lesson id (e.g. u1_l1 → kbl-islamic-s1-nccd-u1_l1). */
export function islamicSem1LessonKbId(jsonLessonId: string): string {
  return lessonKbId(SCOPE, jsonLessonId);
}

/** Look up a JSON lesson by mapped KB lesson id. */
export function findIslamicSem1LessonByKbId(kbLessonId: string): IslamicSem1Lesson | null {
  const prefix = lessonKbPrefix(SCOPE);
  if (!kbLessonId.startsWith(prefix)) return null;
  const jsonId = kbLessonId.slice(prefix.length);
  for (const u of nccdG10IslamicSem1.units) {
    const hit = u.lessons.find(l => l.id === jsonId);
    if (hit) return hit;
  }
  return null;
}

/**
 * Map the Islamic Education JSON into KB units + lessons for book kb-islamic-10-s1.
 * Arabic strings are copied byte-for-byte from the JSON (which copies the
 * student book).
 */
export function buildIslamicSem1Catalog(): { units: ArabicKbUnit[]; lessons: ArabicKbLesson[] } {
  const units: ArabicKbUnit[] = nccdG10IslamicSem1.units.map(u => ({
    id: islamicSem1UnitKbId(u.id),
    bookId: ISLAMIC_S1_BOOK_ID,
    order: u.number,
    titleAr: u.title_ar,
    titleEn: u.title_en,
  }));

  const lessons: ArabicKbLesson[] = [];
  for (const u of nccdG10IslamicSem1.units) {
    const unitKbId = islamicSem1UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const vocab = lesson.vocabulary ?? [];
      const objectives = lesson.objectives ?? [];
      lessons.push({
        id: islamicSem1LessonKbId(lesson.id),
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
export const ISLAMIC_S1_CURRICULUM_BOOK_ID = 'book-islamic-10-s1';

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
 * book-islamic-10-s1. Same ids as the KB catalog above, so a lesson picked in
 * the browser and the same lesson pulled from the KB agree.
 *
 * Every lesson here carries a real `periods` from the guide, so the `?? 1`
 * fallback in estimatedDuration never fires for this book — it is kept only so
 * the shape matches the other catalogs.
 */
export function buildIslamicSem1BrowserCatalog(): {
  units: ArabicBrowserUnit[];
  lessons: ArabicBrowserLesson[];
} {
  const units: ArabicBrowserUnit[] = nccdG10IslamicSem1.units.map(u => {
    const lessonTitles = u.lessons.map(l => l.title_ar).join(' · ');
    return {
      id: islamicSem1UnitKbId(u.id),
      bookId: ISLAMIC_S1_CURRICULUM_BOOK_ID,
      name: u.title_en,
      nameAr: u.title_ar,
      description: lessonTitles,
      descriptionAr: lessonTitles,
      order: u.number,
    };
  });

  const lessons: ArabicBrowserLesson[] = [];
  for (const u of nccdG10IslamicSem1.units) {
    const unitKbId = islamicSem1UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const objectives = [...(lesson.objectives ?? [])];
      const vocabulary = (lesson.vocabulary ?? []).map(v => v.ar);
      const lessonKbId = islamicSem1LessonKbId(lesson.id);
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
