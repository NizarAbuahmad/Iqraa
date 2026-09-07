/**
 * Grade 10 Digital Skills (المهارات الرقمية) — Semester 2 (NCCD student book).
 * Source of truth: data/iqra_curriculum_g10_digital_sem2.json
 *
 * Same lesson-opener convention as biology, physics and earth science, with
 * two differences worth knowing before reading an empty field as a bug:
 *
 * 1. **No teacher guide exists for this subject.** Every `objectives` is empty
 *    and every `periods` is null, because the student book prints neither. It
 *    prints «الفكرة الرئيسة» and «مصطلحات ومفاهيم» per lesson, which are
 *    learning intentions and vocabulary, not a numbered outcomes list —
 *    deriving outcomes from them would be authoring, not transcription. The
 *    browser therefore shows every lesson with a defaulted 45-minute period
 *    and no outcomes, and `verify --gaps` reports it.
 * 2. **Titles were read from the printed page, not the extracted text.** The
 *    extraction passes the document-level gate comfortably (2.0% lam / 3.0%
 *    word transposition) but the display fonts used for headings still come
 *    out scrambled — page 1 yields «جلنة اإلرشاف عىل التأليف». Body text is
 *    clean, so passages ground fine; headings are what had to be read by eye.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g10_digital_sem2.json' with { type: 'json' };
import {
  lessonKbId,
  lessonKbPrefix,
  objectiveId,
  unitKbId,
  type CurriculumIdScope,
} from '../curriculumIds.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const DIGITAL_S2_BOOK_ID = 'kb-digital-10-s2';

export type DigitalSem2Vocab = { ar: string; en: string };

export type DigitalSem2Lesson = {
  id: string;
  order: number;
  type?: string;
  title_ar: string;
  title_en: string;
  main_idea_ar: string;
  periods: number | null;
  objectives: string[];
  vocabulary: DigitalSem2Vocab[];
};

export type DigitalSem2Unit = {
  id: string;
  number: number;
  title_ar: string;
  title_en: string;
  general_idea_ar: string;
  total_periods: number | null;
  prior_knowledge: string[];
  lessons: DigitalSem2Lesson[];
};

export type DigitalSem2CurriculumFile = {
  meta: Record<string, unknown>;
  units: DigitalSem2Unit[];
};

export const nccdG10DigitalSem2 = raw as DigitalSem2CurriculumFile;

/** Shape compatible with KBUnit / KBLesson in knowledgeBase.ts */
type DigitalKbUnit = {
  id: string;
  bookId: string;
  order: number;
  titleAr: string;
  titleEn: string;
};

type DigitalKbLesson = {
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

const SCOPE: CurriculumIdScope = { gradeId: 'grade-10', subject: 'digital', semester: 2 };

/** Stable KB unit id (e.g. u1 → kbu-digital-s2-nccd-u1). */
export function digitalSem2UnitKbId(jsonUnitId: string): string {
  return unitKbId(SCOPE, jsonUnitId);
}

/** Stable KB lesson id (e.g. u1_l1 → kbl-digital-s2-nccd-u1_l1). */
export function digitalSem2LessonKbId(jsonLessonId: string): string {
  return lessonKbId(SCOPE, jsonLessonId);
}

/** Look up a JSON lesson by mapped KB lesson id. */
export function findDigitalSem2LessonByKbId(kbLessonId: string): DigitalSem2Lesson | null {
  const prefix = lessonKbPrefix(SCOPE);
  if (!kbLessonId.startsWith(prefix)) return null;
  const jsonId = kbLessonId.slice(prefix.length);
  for (const u of nccdG10DigitalSem2.units) {
    const hit = u.lessons.find(l => l.id === jsonId);
    if (hit) return hit;
  }
  return null;
}

/**
 * Map the digital-skills JSON into KB units + lessons for kb-digital-10-s2.
 * Arabic strings are copied byte-for-byte from the JSON (which copies the
 * student book's printed table of contents).
 */
export function buildDigitalSem2Catalog(): { units: DigitalKbUnit[]; lessons: DigitalKbLesson[] } {
  const units: DigitalKbUnit[] = nccdG10DigitalSem2.units.map(u => ({
    id: digitalSem2UnitKbId(u.id),
    bookId: DIGITAL_S2_BOOK_ID,
    order: u.number,
    titleAr: u.title_ar,
    titleEn: u.title_en,
  }));

  const lessons: DigitalKbLesson[] = [];
  for (const u of nccdG10DigitalSem2.units) {
    const uKbId = digitalSem2UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const vocab = lesson.vocabulary ?? [];
      const objectives = lesson.objectives ?? [];
      lessons.push({
        id: digitalSem2LessonKbId(lesson.id),
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
export const DIGITAL_S2_CURRICULUM_BOOK_ID = 'book-digital-10-s2';

/** Shape compatible with Unit / Lesson in curriculumData.ts */
type DigitalBrowserUnit = {
  id: string;
  bookId: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  order: number;
};

type DigitalBrowserLesson = {
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
 * Map the digital-skills S2 JSON into curriculum-browser Unit/Lesson rows.
 *
 * `outcomes` comes out empty for every lesson here, because `objectives` is —
 * see the header. That is a content gap, not a mapping bug: the day a teacher
 * guide arrives, filling the JSON fills these with no change to this file.
 */
export function buildDigitalSem2BrowserCatalog(): {
  units: DigitalBrowserUnit[];
  lessons: DigitalBrowserLesson[];
} {
  const units: DigitalBrowserUnit[] = nccdG10DigitalSem2.units.map(u => {
    const lessonTitles = u.lessons.map(l => l.title_ar).join(' · ');
    return {
      id: digitalSem2UnitKbId(u.id),
      bookId: DIGITAL_S2_CURRICULUM_BOOK_ID,
      name: u.title_en,
      nameAr: u.title_ar,
      description: lessonTitles,
      descriptionAr: lessonTitles,
      order: u.number,
    };
  });

  const lessons: DigitalBrowserLesson[] = [];
  for (const u of nccdG10DigitalSem2.units) {
    const uKbId = digitalSem2UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const objectives = [...(lesson.objectives ?? [])];
      const vocabulary = (lesson.vocabulary ?? []).map(v => v.ar);
      const lKbId = digitalSem2LessonKbId(lesson.id);
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
