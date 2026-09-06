/**
 * Grade 10 English — vocational-track coursebooks (Commerce, Agriculture,
 * Hospitality and Tourism, Industrial/Technical), Semester 1.
 *
 * Unlike math/chem/finlit, these are commercial ESP (English for Specific
 * Purposes) coursebooks (York Press / Pearson, adapted by the Educational
 * Research Center) rather than NCCD-published Arabic textbooks — see each
 * data file's `meta.curriculum_authority` and `known_gaps` for exactly what
 * is and is not confirmed/sourced. Arabic fields are translations authored
 * for this catalog: the source books are English-only.
 *
 * Three tracks (Commerce, Agriculture, Hospitality) share one book format —
 * a "Student's Book scope and sequence" table giving, per unit, a listening
 * topic, a reading topic, a vocabulary focus, a grammar focus, a career
 * skill, and a writing task + tip. The fourth (Industrial/Technical) is a
 * different coursebook with a different format — a unit-opening "Briefing"
 * paragraph plus numbered focus sections — because the matching Level-2
 * "industry english" title could not be extracted (see that data file's
 * known_gaps). Two small builder functions below map each shape onto the
 * same browser Unit/Lesson rows. A third mapper (`toKbCatalog`) reshapes
 * that same browser output into the KBUnit/KBLesson shape
 * `services/knowledgeBase.ts` expects — mirroring how every other subject
 * grounds AI generation (TopicSelector's unit/lesson picker, the "grounded"
 * badge) — so there is exactly one place that assembles each lesson's
 * objectives/vocabulary, not two.
 */
import commerceRaw from '../data/iqra_curriculum_g10_english_commerce.json' with { type: 'json' };
import agricultureRaw from '../data/iqra_curriculum_g10_english_agriculture.json' with { type: 'json' };
import hospitalityRaw from '../data/iqra_curriculum_g10_english_hospitality.json' with { type: 'json' };
import industryRaw from '../data/iqra_curriculum_g10_english_industry.json' with { type: 'json' };
import {
  lessonKbId,
  objectiveId,
  unitKbId,
  type CurriculumIdScope,
} from '../curriculumIds.ts';

// ─── Shapes shared with catalog.ts's Unit / Lesson ───────────────────────────
type BrowserUnit = {
  id: string;
  bookId: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  order: number;
};

type BrowserLesson = {
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

/** ~2 class periods per unit — no period count is printed in either source. */
const DEFAULT_UNIT_DURATION_MIN = 90;

function buildOutcomes(
  scope: CurriculumIdScope,
  jsonLessonId: string,
  lessonId: string,
  objectives: string[],
  objectivesAr: string[],
): BrowserLesson['outcomes'] {
  return objectives.map((description, i) => ({
    id: objectiveId(scope, jsonLessonId, i),
    lessonId,
    description,
    descriptionAr: objectivesAr[i] ?? description,
    bloomsLevel: 'Understand' as const,
    skills: [],
  }));
}

// ─── Commerce / Agriculture / Hospitality: scope-and-sequence shape ─────────
type VocTopic = { en: string; ar: string };

type VocLesson = {
  id: string;
  order: number;
  title_en: string;
  title_ar: string;
  listening_topic: VocTopic;
  reading_topic: VocTopic;
  vocabulary_topic: VocTopic;
  grammar_topic: VocTopic;
  career_skill: VocTopic;
  writing_task: VocTopic;
  writing_tip: VocTopic;
};

type VocUnit = {
  id: string;
  number: number;
  title_en: string;
  title_ar: string;
  data_tier: string;
  prior_knowledge: string[];
  lessons: VocLesson[];
};

type VocCurriculumFile = { meta: Record<string, unknown>; units: VocUnit[] };

function buildVocationalTrackCatalog(
  scope: CurriculumIdScope,
  bookId: string,
  data: VocCurriculumFile,
): { units: BrowserUnit[]; lessons: BrowserLesson[] } {
  const units: BrowserUnit[] = data.units.map(u => ({
    id: unitKbId(scope, u.id),
    bookId,
    name: u.title_en,
    nameAr: u.title_ar,
    description: u.lessons.map(l => `${l.listening_topic.en} / ${l.reading_topic.en}`).join(' · '),
    descriptionAr: u.lessons.map(l => `${l.listening_topic.ar} / ${l.reading_topic.ar}`).join(' · '),
    order: u.number,
  }));

  const lessons: BrowserLesson[] = [];
  for (const u of data.units) {
    const unitId = unitKbId(scope, u.id);
    for (const lesson of u.lessons) {
      const lessonId = lessonKbId(scope, lesson.id);
      const objectives = [
        `Listening & reading: ${lesson.listening_topic.en} / ${lesson.reading_topic.en}`,
        `Vocabulary: ${lesson.vocabulary_topic.en}`,
        `Grammar: ${lesson.grammar_topic.en}`,
        `Career skill: ${lesson.career_skill.en}`,
        `Writing: ${lesson.writing_task.en} (tip: ${lesson.writing_tip.en})`,
      ];
      const objectivesAr = [
        `الاستماع والقراءة: ${lesson.listening_topic.ar} / ${lesson.reading_topic.ar}`,
        `المفردات: ${lesson.vocabulary_topic.ar}`,
        `القواعد: ${lesson.grammar_topic.ar}`,
        `مهارة مهنية: ${lesson.career_skill.ar}`,
        `الكتابة: ${lesson.writing_task.ar} (نصيحة: ${lesson.writing_tip.ar})`,
      ];
      lessons.push({
        id: lessonId,
        unitId,
        title: lesson.title_en,
        titleAr: lesson.title_ar,
        estimatedDuration: DEFAULT_UNIT_DURATION_MIN,
        objectives,
        objectivesAr,
        keywords: [lesson.vocabulary_topic.en, lesson.grammar_topic.en, lesson.career_skill.en],
        keywordsAr: [lesson.vocabulary_topic.ar, lesson.grammar_topic.ar, lesson.career_skill.ar],
        teacherNotes: '',
        teacherNotesAr: '',
        outcomes: buildOutcomes(scope, lesson.id, lessonId, objectives, objectivesAr),
      });
    }
  }
  return { units, lessons };
}

// ─── Industrial/Technical: briefing + focus-areas shape ─────────────────────
type TechFocusArea = { en: string; ar: string };

type TechUnit = {
  id: string;
  number: number;
  title_en: string;
  title_ar: string;
  briefing_en: string;
  briefing_ar: string;
  focus_areas: TechFocusArea[];
  data_tier: string;
  prior_knowledge: string[];
};

type TechCurriculumFile = { meta: Record<string, unknown>; units: TechUnit[] };

function buildTechnicalTrackCatalog(
  scope: CurriculumIdScope,
  bookId: string,
  data: TechCurriculumFile,
): { units: BrowserUnit[]; lessons: BrowserLesson[] } {
  const units: BrowserUnit[] = data.units.map(u => ({
    id: unitKbId(scope, u.id),
    bookId,
    name: u.title_en,
    nameAr: u.title_ar,
    description: u.focus_areas.map(f => f.en).join(' · ') || u.briefing_en,
    descriptionAr: u.focus_areas.map(f => f.ar).join(' · ') || u.briefing_ar,
    order: u.number,
  }));

  const lessons: BrowserLesson[] = data.units.map(u => {
    const unitId = unitKbId(scope, u.id);
    const jsonLessonId = `${u.id}_l1`;
    const lessonId = lessonKbId(scope, jsonLessonId);
    const objectives = [
      u.briefing_en,
      ...u.focus_areas.map(f => `Focus: ${f.en}`),
    ];
    const objectivesAr = [
      u.briefing_ar,
      ...u.focus_areas.map(f => `محور: ${f.ar}`),
    ];
    return {
      id: lessonId,
      unitId,
      title: u.title_en,
      titleAr: u.title_ar,
      estimatedDuration: DEFAULT_UNIT_DURATION_MIN,
      objectives,
      objectivesAr,
      keywords: u.focus_areas.map(f => f.en),
      keywordsAr: u.focus_areas.map(f => f.ar),
      teacherNotes: '',
      teacherNotesAr: '',
      outcomes: buildOutcomes(scope, jsonLessonId, lessonId, objectives, objectivesAr),
    };
  });
  return { units, lessons };
}

// ─── KB shape (services/knowledgeBase.ts's KBUnit / KBLesson) ────────────────
// Every lesson here is a single unit-wide lesson (one lesson per unit, see the
// module docs), so `order` is always 1 — there is no second lesson to order
// against.
type KbUnit = { id: string; bookId: string; order: number; titleAr: string; titleEn: string };
type KbLesson = {
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
 * Reshape a browser-shape {units, lessons} pair into KB-shape, for one book.
 *
 * `kbBookId` is deliberately a separate parameter, not `unit.bookId` carried
 * over: the browser catalog's book lives in catalog.ts's `BOOKS` id space
 * (`book-english-10-commerce`), the KB catalog's book lives in
 * `knowledgeBase.ts`'s separate `KB_BOOKS` id space (`kb-eng-commerce-10-s1`)
 * — the same split finlit's `FINLIT_S1_BOOK_ID` vs
 * `FINLIT_S1_CURRICULUM_BOOK_ID` makes. Unit/lesson ids need no such
 * remapping: both shapes already share the `kbu-`/`kbl-` ids from
 * `curriculumIds.ts`.
 */
function toKbCatalog(
  browser: { units: BrowserUnit[]; lessons: BrowserLesson[] },
  kbBookId: string,
): { units: KbUnit[]; lessons: KbLesson[] } {
  const units: KbUnit[] = browser.units.map(u => ({
    id: u.id,
    bookId: kbBookId,
    order: u.order,
    titleAr: u.nameAr,
    titleEn: u.name,
  }));
  const lessons: KbLesson[] = browser.lessons.map(l => ({
    id: l.id,
    unitId: l.unitId,
    order: 1,
    titleAr: l.titleAr,
    titleEn: l.title,
    summaryAr: l.objectivesAr.join('؛ '),
    summaryEn: l.objectives.join('; '),
    keyConceptsAr: l.keywordsAr,
    keyConceptsEn: l.keywords,
    keyTerms: l.keywords.map((en, i) => ({
      en,
      ar: l.keywordsAr[i] ?? en,
      definitionAr: '',
      definitionEn: '',
    })),
    objectives: l.objectives,
    periods: null,
  }));
  return { units, lessons };
}

// ─── Book ids (browser id space, catalog.ts's BOOKS) ─────────────────────────
export const ENGLISH_COMMERCE_S1_CURRICULUM_BOOK_ID = 'book-english-10-commerce';
export const ENGLISH_AGRICULTURE_S1_CURRICULUM_BOOK_ID = 'book-english-10-agriculture';
export const ENGLISH_HOSPITALITY_S1_CURRICULUM_BOOK_ID = 'book-english-10-hospitality';
export const ENGLISH_INDUSTRY_S1_CURRICULUM_BOOK_ID = 'book-english-10-industry';

// ─── Book ids (KB id space, services/knowledgeBase.ts's KB_BOOKS) ────────────
export const ENGLISH_COMMERCE_S1_KB_BOOK_ID = 'kb-eng-commerce-10-s1';
export const ENGLISH_AGRICULTURE_S1_KB_BOOK_ID = 'kb-eng-agriculture-10-s1';
export const ENGLISH_HOSPITALITY_S1_KB_BOOK_ID = 'kb-eng-hospitality-10-s1';
export const ENGLISH_INDUSTRY_S1_KB_BOOK_ID = 'kb-eng-industry-10-s1';

const COMMERCE_SCOPE: CurriculumIdScope = { gradeId: 'grade-10', subject: 'eng-commerce', semester: 1 };
const AGRICULTURE_SCOPE: CurriculumIdScope = { gradeId: 'grade-10', subject: 'eng-agri', semester: 1 };
const HOSPITALITY_SCOPE: CurriculumIdScope = { gradeId: 'grade-10', subject: 'eng-hospitality', semester: 1 };
const INDUSTRY_SCOPE: CurriculumIdScope = { gradeId: 'grade-10', subject: 'eng-industry', semester: 1 };

export function buildEnglishCommerceBrowserCatalog() {
  return buildVocationalTrackCatalog(
    COMMERCE_SCOPE,
    ENGLISH_COMMERCE_S1_CURRICULUM_BOOK_ID,
    commerceRaw as VocCurriculumFile,
  );
}

export function buildEnglishAgricultureBrowserCatalog() {
  return buildVocationalTrackCatalog(
    AGRICULTURE_SCOPE,
    ENGLISH_AGRICULTURE_S1_CURRICULUM_BOOK_ID,
    agricultureRaw as VocCurriculumFile,
  );
}

export function buildEnglishHospitalityBrowserCatalog() {
  return buildVocationalTrackCatalog(
    HOSPITALITY_SCOPE,
    ENGLISH_HOSPITALITY_S1_CURRICULUM_BOOK_ID,
    hospitalityRaw as VocCurriculumFile,
  );
}

export function buildEnglishIndustryBrowserCatalog() {
  return buildTechnicalTrackCatalog(
    INDUSTRY_SCOPE,
    ENGLISH_INDUSTRY_S1_CURRICULUM_BOOK_ID,
    industryRaw as TechCurriculumFile,
  );
}

// ─── KB-shape catalogs — for services/knowledgeBase.ts's KB_UNITS/KB_LESSONS ─
export function buildEnglishCommerceKbCatalog() {
  return toKbCatalog(buildEnglishCommerceBrowserCatalog(), ENGLISH_COMMERCE_S1_KB_BOOK_ID);
}

export function buildEnglishAgricultureKbCatalog() {
  return toKbCatalog(buildEnglishAgricultureBrowserCatalog(), ENGLISH_AGRICULTURE_S1_KB_BOOK_ID);
}

export function buildEnglishHospitalityKbCatalog() {
  return toKbCatalog(buildEnglishHospitalityBrowserCatalog(), ENGLISH_HOSPITALITY_S1_KB_BOOK_ID);
}

export function buildEnglishIndustryKbCatalog() {
  return toKbCatalog(buildEnglishIndustryBrowserCatalog(), ENGLISH_INDUSTRY_S1_KB_BOOK_ID);
}
