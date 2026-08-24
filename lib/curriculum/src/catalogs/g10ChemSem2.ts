/**
 * Grade 10 Chemistry — Semester 2 curriculum (NCCD student book + teacher guide).
 * Source of truth: data/iqra_curriculum_g10_chem_sem2.json
 *
 * Same shape as g10ChemSem1: the student book prints الفكرة الرئيسة,
 * نتاجات التعلم and bilingual المفاهيم والمصطلحات in every lesson opener, so
 * every core lesson is lesson-level data. Unlike S1, the S2 teacher guide was
 * on hand when this was built, so periods are real (2–4 per lesson, 9 per
 * unit) rather than null.
 *
 * What it replaces: two hand-authored placeholder units in knowledgeBase.ts —
 * one titled «الوحدة الرابعة» with no real title at all, and one calling
 * unit 5 «التفاعلات الكيميائية» when that is unit 4's subject and unit 5 is
 * الطاقة الكيميائية. A teacher browsing chemistry S2 was being shown a
 * placeholder and a wrong answer.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g10_chem_sem2.json' with { type: 'json' };

/** Book id in KB_BOOKS that this JSON supersedes. */
export const CHEM_S2_BOOK_ID = 'kb-chem-10-s2';

export type ChemSem2Vocab = { ar: string; en: string };

export type ChemSem2Lesson = {
  id: string;
  order: number;
  type?: string;
  title_ar: string;
  title_en: string;
  main_idea_ar: string;
  periods: number | null;
  objectives: string[];
  /** Experiments/activities the teacher guide's مخطط الوحدة names for this lesson. */
  activities?: string[];
  vocabulary: ChemSem2Vocab[];
};

export type ChemSem2Unit = {
  id: string;
  number: number;
  title_ar: string;
  title_en: string;
  general_idea_ar: string;
  data_tier?: string;
  total_periods: number | null;
  /** What the guide says students met in earlier grades, tagged with the grade. */
  prior_knowledge?: string[];
  lessons: ChemSem2Lesson[];
};

export type ChemSem2CurriculumFile = {
  meta: Record<string, unknown>;
  units: ChemSem2Unit[];
};

export const nccdG10ChemSem2 = raw as ChemSem2CurriculumFile;

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

/** Stable KB unit id (e.g. u4 → kbu-chem-s2-nccd-u4). */
export function chemSem2UnitKbId(jsonUnitId: string): string {
  return `kbu-chem-s2-nccd-${jsonUnitId}`;
}

/** Stable KB lesson id (e.g. u4_l1 → kbl-chem-s2-nccd-u4_l1). */
export function chemSem2LessonKbId(jsonLessonId: string): string {
  return `kbl-chem-s2-nccd-${jsonLessonId}`;
}

/** Look up a JSON lesson by mapped KB lesson id. */
export function findChemSem2LessonByKbId(kbLessonId: string): ChemSem2Lesson | null {
  const prefix = 'kbl-chem-s2-nccd-';
  if (!kbLessonId.startsWith(prefix)) return null;
  const jsonId = kbLessonId.slice(prefix.length);
  for (const u of nccdG10ChemSem2.units) {
    const hit = u.lessons.find(l => l.id === jsonId);
    if (hit) return hit;
  }
  return null;
}

/**
 * Map the chemistry S2 JSON into KB units + lessons for book kb-chem-10-s2.
 * Arabic strings are copied byte-for-byte from the JSON (which copies the
 * book). Labs carry no objectives — the book prints none for them.
 */
export function buildChemSem2Catalog(): { units: ChemKbUnit[]; lessons: ChemKbLesson[] } {
  const units: ChemKbUnit[] = nccdG10ChemSem2.units.map(u => ({
    id: chemSem2UnitKbId(u.id),
    bookId: CHEM_S2_BOOK_ID,
    // Unit numbers continue from semester 1 (the course runs 1–5), so the
    // display order inside this book is 1,2 — not 4,5.
    order: u.number - 3,
    titleAr: u.title_ar,
    titleEn: u.title_en,
  }));

  const lessons: ChemKbLesson[] = [];
  for (const u of nccdG10ChemSem2.units) {
    const unitKbId = chemSem2UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const vocab = lesson.vocabulary ?? [];
      const objectives = lesson.objectives ?? [];
      const isLab = lesson.type === 'lab';
      lessons.push({
        id: chemSem2LessonKbId(lesson.id),
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
