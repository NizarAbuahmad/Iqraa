/**
 * Grade 10 Biology (العلوم الحياتية) — Semester 2 curriculum (NCCD student book).
 * Source of truth: data/iqra_curriculum_g10_bio_sem2.json
 *
 * Carries the second half of unit 3 — lessons 5-9, continuing the numbering
 * from Semester 1 rather than restarting — plus unit 4. No period counts, for
 * the same reason as Semester 1: neither teacher guide yielded usable text.
 *
 * Unlike Semester 1, both `general_idea_ar` values here are present: the
 * unit-opener boxes in this book extracted cleanly where Semester 1’s did not.
 * The defect is per-block, not per-file.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g10_bio_sem2.json' with { type: 'json' };
import {
  lessonKbId,
  lessonKbPrefix,
  objectiveId,
  unitKbId,
  type CurriculumIdScope,
} from '../curriculumIds.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const BIO_S2_BOOK_ID = 'kb-bio-10-s2';

export type BioSem2Vocab = { ar: string; en: string };

export type BioSem2Lesson = {
  id: string;
  order: number;
  type?: string;
  title_ar: string;
  title_en: string;
  main_idea_ar: string;
  periods: number | null;
  objectives: string[];
  vocabulary: BioSem2Vocab[];
};

export type BioSem2Unit = {
  id: string;
  number: number;
  title_ar: string;
  title_en: string;
  general_idea_ar: string;
  total_periods: number | null;
  prior_knowledge: string[];
  lessons: BioSem2Lesson[];
};

export type BioSem2CurriculumFile = {
  meta: Record<string, unknown>;
  units: BioSem2Unit[];
};

export const nccdG10BioSem2 = raw as BioSem2CurriculumFile;

/** Shape compatible with KBUnit / KBLesson in knowledgeBase.ts */
type BioKbUnit = {
  id: string;
  bookId: string;
  order: number;
  titleAr: string;
  titleEn: string;
};

type BioKbLesson = {
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

const SCOPE: CurriculumIdScope = { gradeId: 'grade-10', subject: 'biology', semester: 2 };

/** Stable KB unit id (e.g. u3 → kbu-biology-s2-nccd-u3). */
export function bioSem2UnitKbId(jsonUnitId: string): string {
  return unitKbId(SCOPE, jsonUnitId);
}

/** Stable KB lesson id (e.g. u3_l1 → kbl-biology-s2-nccd-u3_l1). */
export function bioSem2LessonKbId(jsonLessonId: string): string {
  return lessonKbId(SCOPE, jsonLessonId);
}

/** Look up a JSON lesson by mapped KB lesson id. */
export function findBioSem2LessonByKbId(kbLessonId: string): BioSem2Lesson | null {
  const prefix = lessonKbPrefix(SCOPE);
  if (!kbLessonId.startsWith(prefix)) return null;
  const jsonId = kbLessonId.slice(prefix.length);
  for (const u of nccdG10BioSem2.units) {
    const hit = u.lessons.find(l => l.id === jsonId);
    if (hit) return hit;
  }
  return null;
}

/**
 * Map the biology JSON into KB units + lessons for book kb-bio-10-s2.
 * Arabic strings are copied byte-for-byte from the JSON (which copies the
 * student book).
 */
export function buildBioSem2Catalog(): { units: BioKbUnit[]; lessons: BioKbLesson[] } {
  const units: BioKbUnit[] = nccdG10BioSem2.units.map(u => ({
    id: bioSem2UnitKbId(u.id),
    bookId: BIO_S2_BOOK_ID,
    order: u.number,
    titleAr: u.title_ar,
    titleEn: u.title_en,
  }));

  const lessons: BioKbLesson[] = [];
  for (const u of nccdG10BioSem2.units) {
    const uKbId = bioSem2UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const vocab = lesson.vocabulary ?? [];
      const objectives = lesson.objectives ?? [];
      lessons.push({
        id: bioSem2LessonKbId(lesson.id),
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
export const BIO_S2_CURRICULUM_BOOK_ID = 'book-bio-10-s2';

/** Shape compatible with Unit / Lesson in curriculumData.ts */
type BioBrowserUnit = {
  id: string;
  bookId: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  order: number;
};

type BioBrowserLesson = {
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
 * Map the biology S2 JSON into curriculum-browser Unit/Lesson rows for
 * book-bio-10-s2. Same treatment as Semester 1: supersedes nothing, every
 * outcome defaults to `'Understand'` with the `o-nccd-` prefix.
 */
export function buildBioSem2BrowserCatalog(): {
  units: BioBrowserUnit[];
  lessons: BioBrowserLesson[];
} {
  const units: BioBrowserUnit[] = nccdG10BioSem2.units.map(u => {
    const lessonTitles = u.lessons.map(l => l.title_ar).join(' · ');
    return {
      id: bioSem2UnitKbId(u.id),
      bookId: BIO_S2_CURRICULUM_BOOK_ID,
      name: u.title_en,
      nameAr: u.title_ar,
      description: lessonTitles,
      descriptionAr: lessonTitles,
      order: u.number,
    };
  });

  const lessons: BioBrowserLesson[] = [];
  for (const u of nccdG10BioSem2.units) {
    const uKbId = bioSem2UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const objectives = [...(lesson.objectives ?? [])];
      const vocabulary = (lesson.vocabulary ?? []).map(v => v.ar);
      const lKbId = bioSem2LessonKbId(lesson.id);
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
