/**
 * Grade 10 Physics — Semester 2 curriculum (NCCD student book).
 * Source of truth: data/iqra_curriculum_g10_phys_sem2.json
 *
 * Everything here comes from the student book. Unlike Semester 1, not even
 * period counts come from the teacher guide: `phys-s2-teacher-guide` extracts
 * with the definite article transposed («الحركة» → «احلركة») and its extraction
 * was deleted on 2026-09-03, so every `periods` is null and every
 * `total_periods` with it. The PDF is intact in R2 and needs a better
 * extractor or OCR; until then a physics S2 lesson has no duration.
 *
 * Two things recorded in the JSON rather than smoothed over here:
 *
 * 1. Units are numbered 4, 5 and 6 as printed, and no unit 3 exists in either
 *    semester’s student book. Semester 1 shows two units where the guide
 *    counts three, so «الحركة والقوى» appears to absorb the guide’s units 2
 *    and 3 and the numbering resumes at 4. Copied as printed, not renumbered.
 * 2. There are no تجربة استهلالية pages in this book, so no `lab` lessons —
 *    both Semester 1 units have one.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g10_phys_sem2.json' with { type: 'json' };
import {
  lessonKbId,
  lessonKbPrefix,
  objectiveId,
  unitKbId,
  type CurriculumIdScope,
} from '../curriculumIds.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const PHYS_S2_BOOK_ID = 'kb-phys-10-s2';

export type PhysSem2Vocab = { ar: string; en: string };

export type PhysSem2Lesson = {
  id: string;
  order: number;
  type?: string;
  title_ar: string;
  title_en: string;
  main_idea_ar: string;
  periods: number | null;
  /** Set where the book prints a title two different ways; says which was taken. */
  title_note?: string;
  objectives: string[];
  vocabulary: PhysSem2Vocab[];
};

export type PhysSem2Unit = {
  id: string;
  number: number;
  title_ar: string;
  title_en: string;
  general_idea_ar: string;
  total_periods: number | null;
  prior_knowledge: string[];
  lessons: PhysSem2Lesson[];
};

export type PhysSem2CurriculumFile = {
  meta: Record<string, unknown>;
  units: PhysSem2Unit[];
};

export const nccdG10PhysSem2 = raw as PhysSem2CurriculumFile;

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

const SCOPE: CurriculumIdScope = { gradeId: 'grade-10', subject: 'phys', semester: 2 };

/** Stable KB unit id (e.g. u1 → kbu-phys-s1-nccd-u1). */
export function physSem2UnitKbId(jsonUnitId: string): string {
  return unitKbId(SCOPE, jsonUnitId);
}

/** Stable KB lesson id (e.g. u1_l1 → kbl-phys-s1-nccd-u1_l1). */
export function physSem2LessonKbId(jsonLessonId: string): string {
  return lessonKbId(SCOPE, jsonLessonId);
}

/** Look up a JSON lesson by mapped KB lesson id. */
export function findPhysSem2LessonByKbId(kbLessonId: string): PhysSem2Lesson | null {
  const prefix = lessonKbPrefix(SCOPE);
  if (!kbLessonId.startsWith(prefix)) return null;
  const jsonId = kbLessonId.slice(prefix.length);
  for (const u of nccdG10PhysSem2.units) {
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
export function buildPhysSem2Catalog(): { units: PhysKbUnit[]; lessons: PhysKbLesson[] } {
  const units: PhysKbUnit[] = nccdG10PhysSem2.units.map(u => ({
    id: physSem2UnitKbId(u.id),
    bookId: PHYS_S2_BOOK_ID,
    order: u.number,
    titleAr: u.title_ar,
    titleEn: u.title_en,
  }));

  const lessons: PhysKbLesson[] = [];
  for (const u of nccdG10PhysSem2.units) {
    const uKbId = physSem2UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const vocab = lesson.vocabulary ?? [];
      const objectives = lesson.objectives ?? [];
      const isLab = lesson.type === 'lab';
      lessons.push({
        id: physSem2LessonKbId(lesson.id),
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
export const PHYS_S2_CURRICULUM_BOOK_ID = 'book-phys-10-s2';

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
export function buildPhysSem2BrowserCatalog(): {
  units: PhysBrowserUnit[];
  lessons: PhysBrowserLesson[];
} {
  const units: PhysBrowserUnit[] = nccdG10PhysSem2.units.map(u => {
    const lessonTitles = u.lessons.map(l => l.title_ar).join(' · ');
    return {
      id: physSem2UnitKbId(u.id),
      bookId: PHYS_S2_CURRICULUM_BOOK_ID,
      name: u.title_en,
      nameAr: u.title_ar,
      description: lessonTitles,
      descriptionAr: lessonTitles,
      order: u.number,
    };
  });

  const lessons: PhysBrowserLesson[] = [];
  for (const u of nccdG10PhysSem2.units) {
    const uKbId = physSem2UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const objectives = [...(lesson.objectives ?? [])];
      const vocabulary = (lesson.vocabulary ?? []).map(v => v.ar);
      const lKbId = physSem2LessonKbId(lesson.id);
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
