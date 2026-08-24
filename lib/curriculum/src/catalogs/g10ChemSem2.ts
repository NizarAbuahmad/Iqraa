/**
 * Grade 10 Chemistry — Semester 2 curriculum (NCCD student book).
 * Source of truth: data/iqra_curriculum_g10_chem_sem2.json
 *
 * Same shape as g10ChemSem1.ts: the student book prints الفكرة الرئيسة,
 * نتاجات التعلم and bilingual المفاهيم والمصطلحات in every lesson opener, so
 * every core lesson is lesson-level data. The book carries no period counts
 * (periods stay null; see meta.known_gaps).
 *
 * This supersedes two hand-written stub units that named unit 5
 * «التفاعلات الكيميائية» — that is unit 4's subject. Unit 5 is «الطاقة الكيميائية».
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g10_chem_sem2.json' with { type: 'json' };

/** Book id in KB_BOOKS that this JSON supersedes. */
export const CHEM_S2_BOOK_ID = 'kb-chem-10-s2';

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const CHEM_S2_CURRICULUM_BOOK_ID = 'book-chem-10-s2';

export type ChemSem2Vocab = { ar: string; en: string };

export type ChemSem2Lesson = {
  id: string;
  order: number;
  type?: string;
  title_ar: string;
  title_en: string;
  title_note?: string;
  main_idea_ar: string;
  periods: number | null;
  objectives: string[];
  vocabulary: ChemSem2Vocab[];
};

export type ChemSem2Unit = {
  id: string;
  number: number;
  title_ar: string;
  title_en: string;
  /** Provenance tier, read by scripts/verify-curriculum.ts. */
  data_tier?: string;
  general_idea_ar: string;
  total_periods: number | null;
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
 * student book). Labs carry no objectives — the book prints none for them.
 */
export function buildChemSem2Catalog(): { units: ChemKbUnit[]; lessons: ChemKbLesson[] } {
  const units: ChemKbUnit[] = nccdG10ChemSem2.units.map(u => ({
    id: chemSem2UnitKbId(u.id),
    bookId: CHEM_S2_BOOK_ID,
    order: u.number,
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
 * Map the chemistry S2 JSON into curriculum-browser Unit/Lesson rows for
 * book-chem-10-s2. Uses the same ids as the KB catalog above, so a lesson
 * picked in the browser and the same lesson pulled from the KB agree.
 *
 * The student book prints no حصص counts (periods is null for every lesson),
 * so estimatedDuration falls back to one 45-minute period — same convention
 * as the math and financial-literacy catalogs.
 */
export function buildChemSem2BrowserCatalog(): {
  units: ChemBrowserUnit[];
  lessons: ChemBrowserLesson[];
} {
  const units: ChemBrowserUnit[] = nccdG10ChemSem2.units.map(u => {
    const lessonTitles = u.lessons.map(l => l.title_ar).join(' · ');
    return {
      id: chemSem2UnitKbId(u.id),
      bookId: CHEM_S2_CURRICULUM_BOOK_ID,
      name: u.title_en,
      nameAr: u.title_ar,
      description: lessonTitles,
      descriptionAr: lessonTitles,
      order: u.number,
    };
  });

  const lessons: ChemBrowserLesson[] = [];
  for (const u of nccdG10ChemSem2.units) {
    const unitKbId = chemSem2UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const objectives = [...(lesson.objectives ?? [])];
      const vocabulary = (lesson.vocabulary ?? []).map(v => v.ar);
      const lessonKbId = chemSem2LessonKbId(lesson.id);
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
          id: `o-nccd-chem-s2-${lesson.id}-${i}`,
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
