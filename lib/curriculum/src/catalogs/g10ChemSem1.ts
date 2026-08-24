/**
 * Grade 10 Chemistry — Semester 1 curriculum (NCCD student book).
 * Source of truth: data/iqra_curriculum_g10_chem_sem1.json
 *
 * Unlike Math S1 (teacher guide), the chemistry student book prints the
 * الفكرة الرئيسة, نتاجات التعلم and bilingual المفاهيم والمصطلحات in every
 * lesson opener — so every core lesson here is lesson-level data. The book
 * carries no period counts (periods stay null; see meta.known_gaps).
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g10_chem_sem1.json' with { type: 'json' };

/** Book id in KB_BOOKS that this JSON supersedes. */
export const CHEM_S1_BOOK_ID = 'kb-chem-10-s1';

export type ChemSem1Vocab = { ar: string; en: string };

export type ChemSem1Lesson = {
  id: string;
  order: number;
  type?: string;
  title_ar: string;
  title_en: string;
  title_note?: string;
  main_idea_ar: string;
  periods: number | null;
  objectives: string[];
  vocabulary: ChemSem1Vocab[];
};

export type ChemSem1Unit = {
  id: string;
  number: number;
  title_ar: string;
  title_en: string;
  general_idea_ar: string;
  total_periods: number | null;
  lessons: ChemSem1Lesson[];
};

export type ChemSem1CurriculumFile = {
  meta: Record<string, unknown>;
  units: ChemSem1Unit[];
};

export const nccdG10ChemSem1 = raw as ChemSem1CurriculumFile;

/** Shape compatible with KBUnit / KBLesson in knowledgeBase.ts */
type ChemKbUnit = {
  id: string;
  bookId: string;
  order: number;
  titleAr: string;
  titleEn: string;
};

type ChemKbLesson = {
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

/** Stable KB unit id (e.g. u1 → kbu-chem-s1-nccd-u1). */
export function chemSem1UnitKbId(jsonUnitId: string): string {
  return `kbu-chem-s1-nccd-${jsonUnitId}`;
}

/** Stable KB lesson id (e.g. u1_l1 → kbl-chem-s1-nccd-u1_l1). */
export function chemSem1LessonKbId(jsonLessonId: string): string {
  return `kbl-chem-s1-nccd-${jsonLessonId}`;
}

/** Look up a JSON lesson by mapped KB lesson id. */
export function findChemSem1LessonByKbId(kbLessonId: string): ChemSem1Lesson | null {
  const prefix = 'kbl-chem-s1-nccd-';
  if (!kbLessonId.startsWith(prefix)) return null;
  const jsonId = kbLessonId.slice(prefix.length);
  for (const u of nccdG10ChemSem1.units) {
    const hit = u.lessons.find(l => l.id === jsonId);
    if (hit) return hit;
  }
  return null;
}

/**
 * Map the chemistry JSON into KB units + lessons for book kb-chem-10-s1.
 * Arabic strings are copied byte-for-byte from the JSON (which copies the
 * student book). Labs carry no objectives — the book prints none for them.
 */
export function buildChemSem1Catalog(): { units: ChemKbUnit[]; lessons: ChemKbLesson[] } {
  const units: ChemKbUnit[] = nccdG10ChemSem1.units.map(u => ({
    id: chemSem1UnitKbId(u.id),
    bookId: CHEM_S1_BOOK_ID,
    order: u.number,
    titleAr: u.title_ar,
    titleEn: u.title_en,
  }));

  const lessons: ChemKbLesson[] = [];
  for (const u of nccdG10ChemSem1.units) {
    const unitKbId = chemSem1UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const vocab = lesson.vocabulary ?? [];
      const objectives = lesson.objectives ?? [];
      const isLab = lesson.type === 'lab';
      lessons.push({
        id: chemSem1LessonKbId(lesson.id),
        unitId: unitKbId,
        order: lesson.order,
        titleAr: lesson.title_ar,
        titleEn: lesson.title_en,
        summaryAr: lesson.main_idea_ar
          || (isLab
            ? `تجربة استهلالية لوحدة «${u.title_ar}».`
            : `درس «${lesson.title_ar}» من وحدة «${u.title_ar}».`),
        summaryEn: lesson.main_idea_ar
          ? lesson.main_idea_ar
          : (isLab
            ? `Introductory experiment for unit “${u.title_en}”.`
            : `Lesson “${lesson.title_en}” from unit “${u.title_en}”.`),
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
export const CHEM_S1_CURRICULUM_BOOK_ID = 'book-chem-10';

/** Shape compatible with Unit / Lesson in curriculumData.ts */
type ChemBrowserUnit = {
  id: string;
  bookId: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  order: number;
};

type ChemBrowserLesson = {
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
 * Map the chemistry S1 JSON into curriculum-browser Unit/Lesson rows for
 * book-chem-10. Until this existed the browser served three hand-written units
 * with one lesson each, mislabelled unit 2 as «الجدول الدوري وخواص العناصر»
 * (the book says «التوزيع الإلكتروني والدورية»), and rendered unit 2 with zero
 * lessons — while the KB already served the real nine from this same JSON.
 *
 * Every outcome here is a `'Understand'` default, so ids carry the `o-nccd-`
 * prefix that objectives.ts uses to stamp `bloomsSource: 'defaulted'`. The
 * hand-authored Bloom's levels those rows carried are merged back in by
 * catalog.ts, which owns the hand-authored lessons.
 */
export function buildChemSem1BrowserCatalog(): {
  units: ChemBrowserUnit[];
  lessons: ChemBrowserLesson[];
} {
  const units: ChemBrowserUnit[] = nccdG10ChemSem1.units.map(u => {
    const lessonTitles = u.lessons.map(l => l.title_ar).join(' · ');
    return {
      id: chemSem1UnitKbId(u.id),
      bookId: CHEM_S1_CURRICULUM_BOOK_ID,
      name: u.title_en,
      nameAr: u.title_ar,
      description: lessonTitles,
      descriptionAr: lessonTitles,
      order: u.number,
    };
  });

  const lessons: ChemBrowserLesson[] = [];
  for (const u of nccdG10ChemSem1.units) {
    const unitKbId = chemSem1UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const objectives = [...(lesson.objectives ?? [])];
      const vocabulary = (lesson.vocabulary ?? []).map(v => v.ar);
      const lessonKbId = chemSem1LessonKbId(lesson.id);
      lessons.push({
        id: lessonKbId,
        unitId: unitKbId,
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
          id: `o-nccd-chem-s1-${lesson.id}-${i}`,
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
