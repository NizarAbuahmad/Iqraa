/**
 * Grade 10 English — Semester 2 curriculum (NCCD student book).
 * Source of truth: data/iqra_curriculum_g10_english_sem2.json
 *
 * GENERAL English, not one of the four vocational ESP tracks. Those live in
 * `g10EnglishVocational.ts` and use their own `eng-commerce` / `eng-agri` /
 * `eng-hospitality` / `eng-industry` subject slugs; this one is `eng`.
 *
 * Seven lessons per unit, on the same evidence as `g10EnglishSem1.ts` — read
 * that file's doc comment: this one used to carry the identical (and wrong)
 * "one lesson per unit is forced by the book" justification, page-52 claim
 * included, about a page in the *other* book. This book prints the same
 * `LESSON nA` headers and exactly one `□ I can …` per lesson, 35 of them,
 * 5 units × 7.
 *
 * Two things are this book's own. It is a DRAFT — 79 of its 80 pages carry
 * «نسخة قيد الإعداد والتجهيز» — and its contents spread misprints one page
 * reference: unit 6's «p9 Relationships and caring for others» is printed on
 * page 11, under the banner `LESSON 6A VOCABULARY | Relationships, caring for
 * others`. The banner decides where the entry is filed; the reference is kept
 * as printed. Both are recorded in the JSON's `known_gaps`.
 *
 * The two-page 'Contents' scope-and-sequence spread is still carried — with
 * the book's own page references intact — and still becomes the lesson's key
 * concepts, which is what grounding and the generators read; each entry now
 * sits on the lesson whose printed pages it names.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g10_english_sem2.json' with { type: 'json' };
import {
  lessonKbId,
  lessonKbPrefix,
  objectiveId,
  unitKbId,
  type CurriculumIdScope,
} from '../curriculumIds.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const ENG_S2_BOOK_ID = 'kb-eng-10-s2';

/** A scope-and-sequence cell: what the book prints for one skill column. */
export type EngTopic = { en: string; ar: string };

export type EngSem2Lesson = {
  id: string;
  order: number;
  title_ar: string;
  title_en: string;
  /** The lesson's printed `I can …` statement. English, as the book prints it. */
  main_idea_ar: string;
  periods: number | null;
  objectives: string[];
  vocabulary: string[];
  grammar_topic?: EngTopic;
  vocabulary_topic?: EngTopic;
  reading_topic?: EngTopic;
  listening_topic?: EngTopic;
  speaking_topic?: EngTopic;
  writing_task?: EngTopic;
  life_skill?: EngTopic;
};

export type EngSem2Unit = {
  id: string;
  number: number;
  title_ar: string;
  title_en: string;
  total_periods: number | null;
  prior_knowledge: string[];
  lessons: EngSem2Lesson[];
};

export type EngSem2CurriculumFile = {
  meta: Record<string, unknown>;
  units: EngSem2Unit[];
};

export const nccdG10EngSem2 = raw as EngSem2CurriculumFile;

const SCOPE: CurriculumIdScope = { gradeId: 'grade-10', subject: 'eng', semester: 2 };

/** Stable KB unit id (e.g. uu6 -> kbu-eng-s2-nccd-uu6). */
export function engSem2UnitKbId(jsonUnitId: string): string {
  return unitKbId(SCOPE, jsonUnitId);
}

/** Stable KB lesson id (e.g. uu6_l1 -> kbl-eng-s2-nccd-uu6_l1). */
export function engSem2LessonKbId(jsonLessonId: string): string {
  return lessonKbId(SCOPE, jsonLessonId);
}

/** Look up a JSON lesson by mapped KB lesson id. */
export function findEngSem2LessonByKbId(kbLessonId: string): EngSem2Lesson | null {
  const prefix = lessonKbPrefix(SCOPE);
  if (!kbLessonId.startsWith(prefix)) return null;
  const jsonId = kbLessonId.slice(prefix.length);
  for (const u of nccdG10EngSem2.units) {
    const hit = u.lessons.find(l => l.id === jsonId);
    if (hit) return hit;
  }
  return null;
}

/**
 * The scope-and-sequence cells a lesson carries, in the book's column order.
 *
 * Skipping absent ones rather than emitting empty strings: LIFE SKILLS appears
 * after only two units per book, and a blank «مهارة حياتية:» bullet on the
 * other three would read as missing data rather than as a spread that is not
 * there.
 */
function topicLines(lesson: EngSem2Lesson, lang: 'en' | 'ar'): string[] {
  const labels: Array<[keyof EngSem2Lesson, string, string]> = [
    ['grammar_topic', 'Grammar', 'القواعد'],
    ['vocabulary_topic', 'Vocabulary', 'المفردات'],
    ['reading_topic', 'Reading', 'القراءة'],
    ['listening_topic', 'Listening', 'الاستماع'],
    ['speaking_topic', 'Speaking', 'المحادثة'],
    ['writing_task', 'Writing', 'الكتابة'],
    ['life_skill', 'Life skill', 'مهارة حياتية'],
  ];
  const out: string[] = [];
  for (const [key, en, ar] of labels) {
    const cell = lesson[key] as EngTopic | undefined;
    if (!cell) continue;
    out.push(lang === 'ar' ? `${ar}: ${cell.ar}` : `${en}: ${cell.en}`);
  }
  return out;
}

/** Shape compatible with KBUnit / KBLesson in knowledgeBase.ts */
type EngKbUnit = {
  id: string;
  bookId: string;
  order: number;
  titleAr: string;
  titleEn: string;
};

type EngKbLesson = {
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

/**
 * Map the English S2 JSON into KB units + lessons for book kb-eng-10-s2.
 *
 * The scope-and-sequence cells become `keyConcepts`, which is what the
 * generators and grounding actually read — so a worksheet for «Do the right thing»
 * knows the unit is about conditionals, communicating and emotions, rather than only its title.
 */
export function buildEngSem2Catalog(): { units: EngKbUnit[]; lessons: EngKbLesson[] } {
  const units: EngKbUnit[] = nccdG10EngSem2.units.map(u => ({
    id: engSem2UnitKbId(u.id),
    bookId: ENG_S2_BOOK_ID,
    order: u.number,
    titleAr: u.title_ar,
    titleEn: u.title_en,
  }));

  const lessons: EngKbLesson[] = [];
  for (const u of nccdG10EngSem2.units) {
    const uKbId = engSem2UnitKbId(u.id);
    for (const lesson of u.lessons) {
      lessons.push({
        id: engSem2LessonKbId(lesson.id),
        unitId: uKbId,
        order: lesson.order,
        titleAr: lesson.title_ar,
        titleEn: lesson.title_en,
        // The lesson's own `I can` line, same as `makeNccdCatalog` does with
        // `main_idea_ar`. The unit sentence is the fallback, not the summary.
        summaryAr: lesson.main_idea_ar
          || `وحدة «${u.title_ar}» من كتاب اللغة الإنجليزية للصف العاشر، الفصل الثاني.`,
        summaryEn: lesson.main_idea_ar
          || `Unit “${u.title_en}” of the Grade 10 English student book, semester 2.`,
        keyConceptsAr: topicLines(lesson, 'ar'),
        keyConceptsEn: topicLines(lesson, 'en'),
        keyTerms: [],
        objectives: [...(lesson.objectives ?? [])],
        periods: lesson.periods ?? null,
      });
    }
  }

  return { units, lessons };
}

/** Book id in curriculumData.BOOKS this catalog fills (browser id space). */
export const ENG_S2_CURRICULUM_BOOK_ID = 'book-english-10-s2';

/** Shape compatible with Unit / Lesson in curriculumData.ts */
type EngBrowserUnit = {
  id: string;
  bookId: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  order: number;
};

type EngBrowserLesson = {
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
 * Map the English S2 JSON into curriculum-browser rows for
 * book-english-10-s2 — the book row that carried zero lessons until
 * 2026-09-05, and five title-only stubs until 2026-09-10.
 *
 * `outcomes` used to be empty on the grounds that the book states no
 * objectives. It states 35 of them per semester, one `I can` per lesson, so
 * this now emits the same one-`'Understand'`-outcome-per-objective row every
 * other catalog does. The level is the builder's blanket default, not a
 * judgement; `isDerivedObjectiveId` recognises the `o-eng-s2-` prefix minted
 * here, so `objectives.ts` reports it as derived rather than authored.
 */
export function buildEngSem2BrowserCatalog(): {
  units: EngBrowserUnit[];
  lessons: EngBrowserLesson[];
} {
  const units: EngBrowserUnit[] = nccdG10EngSem2.units.map(u => {
    const summary = u.lessons.flatMap(l => topicLines(l, 'en')).join(' · ');
    const summaryAr = u.lessons.flatMap(l => topicLines(l, 'ar')).join(' · ');
    return {
      id: engSem2UnitKbId(u.id),
      bookId: ENG_S2_CURRICULUM_BOOK_ID,
      name: u.title_en,
      nameAr: u.title_ar,
      description: summary,
      descriptionAr: summaryAr,
      order: u.number,
    };
  });

  const lessons: EngBrowserLesson[] = [];
  for (const u of nccdG10EngSem2.units) {
    const uKbId = engSem2UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const objectives = [...(lesson.objectives ?? [])];
      const lKbId = engSem2LessonKbId(lesson.id);
      lessons.push({
        id: lKbId,
        unitId: uKbId,
        title: lesson.title_en,
        titleAr: lesson.title_ar,
        // The book states no period count; 45 minutes is one period, the same
        // fallback every other browser catalog uses for a null.
        estimatedDuration: (lesson.periods ?? 1) * 45,
        objectives,
        objectivesAr: [...objectives],
        keywords: topicLines(lesson, 'en'),
        keywordsAr: topicLines(lesson, 'ar'),
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
