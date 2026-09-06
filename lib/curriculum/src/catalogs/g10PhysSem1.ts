/**
 * Grade 10 Physics — Semester 1 curriculum (NCCD student book).
 * Source of truth: data/iqra_curriculum_g10_phys_sem1.json
 *
 * Like chemistry and unlike Math S1, the physics student book prints the
 * الفكرة الرئيسة, نتاجات التعلم and bilingual المفاهيم والمصطلحات in every
 * lesson opener, so every core lesson here is lesson-level data copied from
 * the book. Period counts come from the teacher guide's مخطط الوحدة.
 *
 * Two things about physics that chemistry did not have, both recorded in the
 * JSON's `meta.known_gaps` rather than smoothed over here:
 *
 * 1. The teacher guide splits Semester 1 into three units (المتجهات، الحركة،
 *    القوى) where the student book has two, merging the last into «الحركة
 *    والقوى». This file follows the **book**, because the book's lessons are
 *    the ones a teacher and student actually see. `u2_l3` therefore carries
 *    the sum of the guide's two Newton lessons (3 + 5 = 8 periods) and is the
 *    only computed number in the data.
 * 2. The teacher guide's extracted text transposes letters around the
 *    definite article — «الحركة» comes out «احلركة» — irregularly enough that
 *    it cannot be reversed without guessing. No Arabic prose was copied from
 *    it, so `prior_knowledge` is empty here where chemistry's is populated.
 *    That is a known gap, not an oversight.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g10_phys_sem1.json' with { type: 'json' };
import {
  lessonKbId,
  lessonKbPrefix,
  objectiveId,
  unitKbId,
  type CurriculumIdScope,
} from '../curriculumIds.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const PHYS_S1_BOOK_ID = 'kb-phys-10-s1';

export type PhysSem1Vocab = { ar: string; en: string };

export type PhysSem1Lesson = {
  id: string;
  order: number;
  type?: string;
  title_ar: string;
  title_en: string;
  main_idea_ar: string;
  periods: number | null;
  /** Set only where a period count had to be derived; see u2_l3. */
  periods_note?: string;
  objectives: string[];
  vocabulary: PhysSem1Vocab[];
};

export type PhysSem1Unit = {
  id: string;
  number: number;
  title_ar: string;
  title_en: string;
  general_idea_ar: string;
  total_periods: number | null;
  prior_knowledge: string[];
  lessons: PhysSem1Lesson[];
};

export type PhysSem1CurriculumFile = {
  meta: Record<string, unknown>;
  units: PhysSem1Unit[];
};

export const nccdG10PhysSem1 = raw as PhysSem1CurriculumFile;

/** Shape compatible with KBUnit / KBLesson in knowledgeBase.ts */
type PhysKbUnit = {
  id: string;
  bookId: string;
  order: number;
  titleAr: string;
  titleEn: string;
};

type PhysKbLesson = {
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

const SCOPE: CurriculumIdScope = { gradeId: 'grade-10', subject: 'phys', semester: 1 };

/** Stable KB unit id (e.g. u1 → kbu-phys-s1-nccd-u1). */
export function physSem1UnitKbId(jsonUnitId: string): string {
  return unitKbId(SCOPE, jsonUnitId);
}

/** Stable KB lesson id (e.g. u1_l1 → kbl-phys-s1-nccd-u1_l1). */
export function physSem1LessonKbId(jsonLessonId: string): string {
  return lessonKbId(SCOPE, jsonLessonId);
}

/** Look up a JSON lesson by mapped KB lesson id. */
export function findPhysSem1LessonByKbId(kbLessonId: string): PhysSem1Lesson | null {
  const prefix = lessonKbPrefix(SCOPE);
  if (!kbLessonId.startsWith(prefix)) return null;
  const jsonId = kbLessonId.slice(prefix.length);
  for (const u of nccdG10PhysSem1.units) {
    const hit = u.lessons.find(l => l.id === jsonId);
    if (hit) return hit;
  }
  return null;
}

/**
 * Map the physics JSON into KB units + lessons for book kb-phys-10-s1.
 * Arabic strings are copied byte-for-byte from the JSON (which copies the
 * student book). Labs carry no objectives — the book prints none for them.
 */
export function buildPhysSem1Catalog(): { units: PhysKbUnit[]; lessons: PhysKbLesson[] } {
  const units: PhysKbUnit[] = nccdG10PhysSem1.units.map(u => ({
    id: physSem1UnitKbId(u.id),
    bookId: PHYS_S1_BOOK_ID,
    order: u.number,
    titleAr: u.title_ar,
    titleEn: u.title_en,
  }));

  const lessons: PhysKbLesson[] = [];
  for (const u of nccdG10PhysSem1.units) {
    const uKbId = physSem1UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const vocab = lesson.vocabulary ?? [];
      const objectives = lesson.objectives ?? [];
      const isLab = lesson.type === 'lab';
      lessons.push({
        id: physSem1LessonKbId(lesson.id),
        unitId: uKbId,
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
export const PHYS_S1_CURRICULUM_BOOK_ID = 'book-phys-10-s1';

/** Shape compatible with Unit / Lesson in curriculumData.ts */
type PhysBrowserUnit = {
  id: string;
  bookId: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  order: number;
};

type PhysBrowserLesson = {
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
 * Map the physics S1 JSON into curriculum-browser Unit/Lesson rows for
 * book-phys-10-s1.
 *
 * Unlike chemistry, this supersedes nothing: physics had no hand-written rows
 * to replace, so there are no authored Bloom's levels to merge back in and
 * nothing to filter out of the legacy tables. Every outcome is a defaulted
 * `'Understand'`, carrying the `o-nccd-` prefix that objectives.ts reads to
 * stamp `bloomsSource: 'defaulted'` — so Bloom's coverage reports physics as
 * unclassified, which is true, rather than as classified-by-nobody.
 */
export function buildPhysSem1BrowserCatalog(): {
  units: PhysBrowserUnit[];
  lessons: PhysBrowserLesson[];
} {
  const units: PhysBrowserUnit[] = nccdG10PhysSem1.units.map(u => {
    const lessonTitles = u.lessons.map(l => l.title_ar).join(' · ');
    return {
      id: physSem1UnitKbId(u.id),
      bookId: PHYS_S1_CURRICULUM_BOOK_ID,
      name: u.title_en,
      nameAr: u.title_ar,
      description: lessonTitles,
      descriptionAr: lessonTitles,
      order: u.number,
    };
  });

  const lessons: PhysBrowserLesson[] = [];
  for (const u of nccdG10PhysSem1.units) {
    const uKbId = physSem1UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const objectives = [...(lesson.objectives ?? [])];
      const vocabulary = (lesson.vocabulary ?? []).map(v => v.ar);
      const lKbId = physSem1LessonKbId(lesson.id);
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
