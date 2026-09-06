/**
 * Grade 10 English — Semester 1 curriculum (NCCD student book).
 * Source of truth: data/iqra_curriculum_g10_english_sem1.json
 *
 * GENERAL English, not one of the four vocational ESP tracks. Those live in
 * `g10EnglishVocational.ts` and use their own `eng-commerce` / `eng-agri` /
 * `eng-hospitality` / `eng-industry` subject slugs; this one is `eng`.
 *
 * Modelled as ONE lesson per unit, exactly like those four and unlike every
 * science catalog. That is forced by the book, not chosen for convenience: it
 * prints seven lesson slots per unit (LESSON 1A..7A, 18pt, in the page header)
 * and gives none of them a title — only a skill banner (VOCABULARY, GRAMMAR,
 * READING AND VOCABULARY …) whose order changes from unit to unit, and in
 * semester 1 two slots share page 52 with competing banners. A seven-lesson
 * breakdown would therefore be a guess about which slot owns which page, and
 * a figure filed under a guessed lesson is worse than no figure.
 *
 * There are also no نتاجات التعلم to copy: this series prints none, unlike the
 * science student books whose lesson openers state them. `objectives` is empty
 * everywhere here, and `verify --gaps` will say so rather than the catalog
 * pretending otherwise.
 *
 * What the book DOES print, and what is therefore carried, is the two-page
 * scope-and-sequence spread: grammar, vocabulary, reading, listening, speaking
 * and writing per unit, with the book's own page references kept intact. Those
 * become the lesson's key concepts, which is what grounding and the generators
 * read.
 *
 * Note: does not import knowledgeBase (avoids circular dependency).
 */

import raw from '../data/iqra_curriculum_g10_english_sem1.json' with { type: 'json' };
import {
  lessonKbId,
  lessonKbPrefix,
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
        summaryAr: `وحدة «${u.title_ar}» من كتاب اللغة الإنجليزية للصف العاشر، الفصل الأول.`,
        summaryEn: `Unit “${u.title_en}” of the Grade 10 English student book, semester 1.`,
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
 * book-english-10-s1 — the book row that has existed since the catalog was
 * written and has carried zero lessons ever since, so a teacher who picked
 * English and opened it saw nothing at all.
 *
 * `outcomes` is empty rather than defaulted. Every other catalog emits one
 * `'Understand'` outcome per objective; this book states no objectives, so
 * emitting a defaulted outcome would invent a learning outcome the Ministry
 * never wrote. Bloom's coverage then reports English as having none, which is
 * the truth.
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
      lessons.push({
        id: engSem1LessonKbId(lesson.id),
        unitId: uKbId,
        title: lesson.title_en,
        titleAr: lesson.title_ar,
        // The book states no period count; 45 minutes is one period, the same
        // fallback every other browser catalog uses for a null.
        estimatedDuration: (lesson.periods ?? 1) * 45,
        objectives: [],
        objectivesAr: [],
        keywords: topicLines(lesson, 'en'),
        keywordsAr: topicLines(lesson, 'ar'),
        teacherNotes: '',
        teacherNotesAr: '',
        outcomes: [],
      });
    }
  }

  return { units, lessons };
}
