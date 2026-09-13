/**
 * Grade 10 English — Semester 1 curriculum (NCCD student book).
 * Source of truth: data/iqra_curriculum_g10_english_sem1.json
 *
 * GENERAL English, not one of the four vocational ESP tracks. Those live in
 * `g10EnglishVocational.ts` and use their own `eng-commerce` / `eng-agri` /
 * `eng-hospitality` / `eng-industry` subject slugs; this one is `eng`.
 *
 * ## Seven lessons per unit
 *
 * Until 2026-09-10 this file modelled each unit as ONE lesson, and said the
 * book forced it: that the seven `LESSON nA` slots carry no titles, only skill
 * banners, and that two of them "share page 52 with competing banners", so any
 * seven-lesson split would be a guess. **That was wrong, and it was checked
 * against the PDF before being replaced.** The book prints, per lesson, a
 * `LESSON nA` header with a skill banner and — where there is one — a topic
 * after a `|` (`LESSON 2A VOCABULARY | Appearance`), and exactly one
 * `□ I can …` statement: 35 per semester, 5 units × 7, in both semesters. That
 * is identity and outcome both, which is precisely how `g9EngSem1.ts` and
 * `g8EngSem1.ts` already treat the same Pearson "Jordan High Note" series.
 *
 * The shared page is real but harmless, and it was printed page 50, not 52 —
 * 52 is the PDF page. Unit 5's `LESSON 2A VOCABULARY | Phrasal verbs related
 * to studying` occupies the left of printed p50 and `LESSON 3A GRAMMAR` opens
 * on the right and runs onto p51. Each still prints its own single `I can`,
 * which is why lessons are counted by those statements and not by pages.
 *
 * The "no نتاجات التعلم" observation was true and beside the point: the series
 * prints no Arabic outcome list, and the `I can` line is the outcome it prints
 * instead. `objectives` therefore holds the book's own sentence, verbatim in
 * English — translating an outcome changes what a teacher is told the lesson
 * delivers.
 *
 * ## The scope-and-sequence spread is kept, and distributed
 *
 * The two-page 'Contents' spread — grammar, vocabulary, reading, listening,
 * speaking and writing per unit, each entry carrying the book's own page
 * reference — is still carried, and still becomes the lesson's key concepts,
 * which is what grounding and the generators read. Each entry now sits on the
 * lesson whose printed pages it names, so `p6 Appearance, clothes, footwear
 * and accessories` is on LESSON 2A rather than on all of unit 1. A lesson
 * whose banner spans two skills carries both columns. The LIFE SKILLS spreads
 * are not lessons and are parked on the last lesson of the unit they follow;
 * see the JSON's `known_gaps`.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g10_english_sem1.json' with { type: 'json' };
import {
  lessonKbId,
  lessonKbPrefix,
  objectiveId,
  unitKbId,
  type CurriculumIdScope,
} from '../curriculumIds.ts';

/** Book id in KB_BOOKS that this JSON fills. */
export const ENG_S1_BOOK_ID = 'kb-eng-10-s1';

/** A scope-and-sequence cell: what the book prints for one skill column. */
export type EngTopic = { en: string; ar: string };

export type EngSem1Lesson = {
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

export type EngSem1Unit = {
  id: string;
  number: number;
  title_ar: string;
  title_en: string;
  total_periods: number | null;
  prior_knowledge: string[];
  lessons: EngSem1Lesson[];
};

export type EngSem1CurriculumFile = {
  meta: Record<string, unknown>;
  units: EngSem1Unit[];
};

export const nccdG10EngSem1 = raw as EngSem1CurriculumFile;

const SCOPE: CurriculumIdScope = { gradeId: 'grade-10', subject: 'eng', semester: 1 };

/** Stable KB unit id (e.g. uu1 -> kbu-eng-s1-nccd-uu1). */
export function engSem1UnitKbId(jsonUnitId: string): string {
  return unitKbId(SCOPE, jsonUnitId);
}

/** Stable KB lesson id (e.g. uu1_l1 -> kbl-eng-s1-nccd-uu1_l1). */
export function engSem1LessonKbId(jsonLessonId: string): string {
  return lessonKbId(SCOPE, jsonLessonId);
}

/** Look up a JSON lesson by mapped KB lesson id. */
export function findEngSem1LessonByKbId(kbLessonId: string): EngSem1Lesson | null {
  const prefix = lessonKbPrefix(SCOPE);
  if (!kbLessonId.startsWith(prefix)) return null;
  const jsonId = kbLessonId.slice(prefix.length);
  for (const u of nccdG10EngSem1.units) {
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
function topicLines(lesson: EngSem1Lesson, lang: 'en' | 'ar'): string[] {
  const labels: Array<[keyof EngSem1Lesson, string, string]> = [
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
 * Map the English S1 JSON into KB units + lessons for book kb-eng-10-s1.
 *
 * The scope-and-sequence cells become `keyConcepts`, which is what the
 * generators and grounding actually read — so a worksheet for «Looking good»
 * knows the unit is about appearance, clothes and the present tenses, rather than only its title.
 */
export function buildEngSem1Catalog(): { units: EngKbUnit[]; lessons: EngKbLesson[] } {
  const units: EngKbUnit[] = nccdG10EngSem1.units.map(u => ({
    id: engSem1UnitKbId(u.id),
    bookId: ENG_S1_BOOK_ID,
    order: u.number,
    titleAr: u.title_ar,
    titleEn: u.title_en,
  }));

  const lessons: EngKbLesson[] = [];
  for (const u of nccdG10EngSem1.units) {
    const uKbId = engSem1UnitKbId(u.id);
    for (const lesson of u.lessons) {
      lessons.push({
        id: engSem1LessonKbId(lesson.id),
        unitId: uKbId,
        order: lesson.order,
        titleAr: lesson.title_ar,
        titleEn: lesson.title_en,
        // The lesson's own `I can` line, same as `makeNccdCatalog` does with
        // `main_idea_ar`. The unit sentence is the fallback, not the summary.
        summaryAr: lesson.main_idea_ar
          || `وحدة «${u.title_ar}» من كتاب اللغة الإنجليزية للصف العاشر، الفصل الأول.`,
        summaryEn: lesson.main_idea_ar
          || `Unit “${u.title_en}” of the Grade 10 English student book, semester 1.`,
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
export const ENG_S1_CURRICULUM_BOOK_ID = 'book-english-10-s1';

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
 * Map the English S1 JSON into curriculum-browser rows for
 * book-english-10-s1 — the book row that carried zero lessons until
 * 2026-09-05, and five title-only stubs until 2026-09-10.
 *
 * `outcomes` used to be empty on the grounds that the book states no
 * objectives. It states 35 of them per semester, one `I can` per lesson, so
 * this now emits the same one-`'Understand'`-outcome-per-objective row every
 * other catalog does. The level is the builder's blanket default, not a
 * judgement; `isDerivedObjectiveId` recognises the `o-eng-s1-` prefix minted
 * here, so `objectives.ts` reports it as derived rather than authored.
 */
export function buildEngSem1BrowserCatalog(): {
  units: EngBrowserUnit[];
  lessons: EngBrowserLesson[];
} {
  const units: EngBrowserUnit[] = nccdG10EngSem1.units.map(u => {
    const summary = u.lessons.flatMap(l => topicLines(l, 'en')).join(' · ');
    const summaryAr = u.lessons.flatMap(l => topicLines(l, 'ar')).join(' · ');
    return {
      id: engSem1UnitKbId(u.id),
      bookId: ENG_S1_CURRICULUM_BOOK_ID,
      name: u.title_en,
      nameAr: u.title_ar,
      description: summary,
      descriptionAr: summaryAr,
      order: u.number,
    };
  });

  const lessons: EngBrowserLesson[] = [];
  for (const u of nccdG10EngSem1.units) {
    const uKbId = engSem1UnitKbId(u.id);
    for (const lesson of u.lessons) {
      const objectives = [...(lesson.objectives ?? [])];
      const lKbId = engSem1LessonKbId(lesson.id);
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
