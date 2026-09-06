/**
 * Grade 10 Biology (العلوم الحياتية) — Semester 1 curriculum (NCCD student book).
 * Source of truth: data/iqra_curriculum_g10_bio_sem1.json
 *
 * Same lesson-opener convention as physics, chemistry and earth science. No
 * period counts: the S1 teacher guide has no text layer at all and the S2
 * guide extracts with its letters transposed, so neither was ever ingested.
 * Every `periods` is null.
 *
 * Two things specific to biology, both recorded in the JSON rather than
 * smoothed over:
 *
 * 1. **Unit 3 spans both semesters.** It opens here with lessons 1-4 and
 *    continues in g10BioSem2.ts as lessons 5-9, under the same printed unit
 *    number and title. The ids are semester-scoped
 *    (`kbu-biology-s1-nccd-u3` vs `…-s2-…`) so the two halves do not collide.
 * 2. **The corruption in these files is localised, not document-wide.** Every
 *    `general_idea_ar` here is empty because the unit-opener boxes extract as
 *    scrambled letters, while the lesson titles, outcomes and vocabulary on
 *    the very same pages are clean. The file passed the document-level
 *    transposition gate at 13.7% — a reminder that passing it does not mean
 *    every block inside is sound.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g10_bio_sem1.json' with { type: 'json' };
import {
  lessonKbId,
  lessonKbPrefix,
  objectiveId,
  unitKbId,
  type CurriculumIdScope,
} from '../curriculumIds.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const BIO_S1_BOOK_ID = 'kb-bio-10-s1';

export type BioSem1Vocab = { ar: string; en: string };

export type BioSem1Lesson = {
  id: string;
  order: number;
  type?: string;
  title_ar: string;
  title_en: string;
  main_idea_ar: string;
  periods: number | null;
  objectives: string[];
  vocabulary: BioSem1Vocab[];
};

export type BioSem1Unit = {
  id: string;
  number: number;
  title_ar: string;
  title_en: string;
  general_idea_ar: string;
  total_periods: number | null;
  prior_knowledge: string[];
  lessons: BioSem1Lesson[];
};

export type BioSem1CurriculumFile = {
  meta: Record<string, unknown>;
  units: BioSem1Unit[];
};

export const nccdG10BioSem1 = raw as BioSem1CurriculumFile;

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

const SCOPE: CurriculumIdScope = { gradeId: 'grade-10', subject: 'biology', semester: 1 };

/** Stable KB unit id (e.g. u1 → kbu-biology-s1-nccd-u1). */
export function bioSem1UnitKbId(jsonUnitId: string): string {
  return unitKbId(SCOPE, jsonUnitId);
}

/** Stable KB lesson id (e.g. u1_l1 → kbl-biology-s1-nccd-u1_l1). */
export function bioSem1LessonKbId(jsonLessonId: string): string {
  return lessonKbId(SCOPE, jsonLessonId);
}

/** Look up a JSON lesson by mapped KB lesson id. */
export function findBioSem1LessonByKbId(kbLessonId: string): BioSem1Lesson | null {
  const prefix = lessonKbPrefix(SCOPE);
  if (!kbLessonId.startsWith(prefix)) return null;
  const jsonId = kbLessonId.slice(prefix.length);
  for (const u of nccdG10BioSem1.units) {
    const hit = u.lessons.find(l => l.id === jsonId);
    if (hit) return hit;
  }
  return null;
}

/**
 * Map the biology JSON into KB units + lessons for book kb-bio-10-s1.
 * Arabic strings are copied byte-for-byte from the JSON (which copies the
 * student book).
 */
export function buildBioSem1Catalog(): { units: BioKbUnit[]; lessons: BioKbLesson[] } {
  const units: BioKbUnit[] = nccdG10BioSem1.units.map(u => ({
    id: bioSem1UnitKbId(u.id),
    bookId: BIO_S1_BOOK_ID,
    order: u.number,
    titleAr: u.title_ar,
    titleEn: u.title_en,
  }));

  const lessons: BioKbLesson[] = [];
  for (const u of nccdG10BioSem1.units) {
    const uKbId = bioSem1UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const vocab = lesson.vocabulary ?? [];
      const objectives = lesson.objectives ?? [];
      lessons.push({
        id: bioSem1LessonKbId(lesson.id),
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
export const BIO_S1_CURRICULUM_BOOK_ID = 'book-bio-10-s1';

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
 * Map the biology S1 JSON into curriculum-browser Unit/Lesson rows for
 * book-bio-10-s1.
 *
 * Supersedes nothing: biology had no hand-written rows to replace, so
 * there are no authored Bloom's levels to merge back in. Every outcome is a
 * defaulted `'Understand'`, carrying the `o-nccd-` prefix that objectives.ts
 * reads to stamp `bloomsSource: 'defaulted'`.
 */
export function buildBioSem1BrowserCatalog(): {
  units: BioBrowserUnit[];
  lessons: BioBrowserLesson[];
} {
  const units: BioBrowserUnit[] = nccdG10BioSem1.units.map(u => {
    const lessonTitles = u.lessons.map(l => l.title_ar).join(' · ');
    return {
      id: bioSem1UnitKbId(u.id),
      bookId: BIO_S1_CURRICULUM_BOOK_ID,
      name: u.title_en,
      nameAr: u.title_ar,
      description: lessonTitles,
      descriptionAr: lessonTitles,
      order: u.number,
    };
  });

  const lessons: BioBrowserLesson[] = [];
  for (const u of nccdG10BioSem1.units) {
    const uKbId = bioSem1UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const objectives = [...(lesson.objectives ?? [])];
      const vocabulary = (lesson.vocabulary ?? []).map(v => v.ar);
      const lKbId = bioSem1LessonKbId(lesson.id);
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
