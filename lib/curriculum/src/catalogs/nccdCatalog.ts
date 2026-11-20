/**
 * One builder for the NCCD lesson-opener curriculum shape.
 *
 * ## Why this exists
 *
 * Twenty-two files in this directory — `g10ChemSem1.ts` through
 * `g9MathSem2.ts` — are the same 260 lines with the subject slug changed:
 * six exports, two mapping loops, and a pair of locally-redeclared structural
 * types. That is ~5,950 lines, and the Grade 9 corpus delivered on 2026-09-08
 * would have added thirteen more of them.
 *
 * The duplication is not merely long. `buildDigitalSem1BrowserCatalog` and its
 * twenty-one siblings each decide independently what `estimatedDuration` is
 * when `periods` is null, whether `summaryAr` falls back to a generated
 * sentence, and whether `keyTerms` carries empty definitions — so a fix to any
 * of those is a twenty-two-file change that nothing checks you finished.
 *
 * ## What it does not do
 *
 * **The existing twenty-two are left alone.** Their ids are in Postgres
 * free-text columns holding live student work (see `curriculumIds.ts`), and a
 * refactor that touches Grade 10 ids is a data migration, not a tidy-up. This
 * factory is used by new subjects only; converting the old ones is a separate
 * decision with a row count attached.
 *
 * ## The shape it assumes
 *
 * NCCD prints, on each lesson opener: «الفكرةُ الرئيسةُ» (one paragraph),
 * «نتاجاتُ التعلُّمِ» (a list) and «المفاهيمُ والمصطلحاتُ» (bilingual pairs);
 * and on each unit opener a title and a general idea. Period counts are a
 * teacher-guide field and are absent from every student book, so `periods` is
 * routinely null and callers must handle it.
 *
 * A subject whose books do not print those boxes should not be forced through
 * here — write it out longhand rather than leaving fields mysteriously empty.
 */

import {
  lessonKbId as makeLessonKbId,
  lessonKbPrefix,
  objectiveId,
  unitKbId as makeUnitKbId,
  type CurriculumIdScope,
} from '../curriculumIds.ts';

export type NccdVocab = { ar: string; en: string };

export type NccdLesson = {
  id: string;
  order: number;
  type?: string;
  title_ar: string;
  title_en: string;
  main_idea_ar: string;
  periods: number | null;
  objectives: string[];
  vocabulary: NccdVocab[];
  /**
   * The lesson's own self-assessment box as the book prints it (e.g. PE's
   * «أُقيِّمُ تعلُّمي»). Deliberately NOT `objectives`: those reach the model
   * as «النتاجات (من المنهاج الرسمي)», and a self-assessment table is not the
   * book's outcomes list. Absent where the book prints none.
   */
  self_assessment_ar?: string[];
};

export type NccdUnit = {
  id: string;
  number: number;
  title_ar: string;
  title_en: string;
  general_idea_ar: string;
  total_periods: number | null;
  prior_knowledge: string[];
  lessons: NccdLesson[];
  /**
   * The unit's end-of-unit self-assessment table («أقيّم نفسي ذاتيًّا…»), in
   * the book's order. Unit-level because the book prints it per unit; which
   * statement belongs to which lesson is not printed, so it is not guessed.
   */
  self_assessment_ar?: string[];
};

export type NccdCurriculumFile = {
  meta: Record<string, unknown>;
  units: NccdUnit[];
};

/** Shape compatible with KBUnit / KBLesson in knowledgeBase.ts */
export type NccdKbUnit = {
  id: string;
  bookId: string;
  order: number;
  titleAr: string;
  titleEn: string;
};

export type NccdKbLesson = {
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
  /** `NccdLesson.self_assessment_ar`, when the book prints one per lesson. */
  selfAssessmentAr?: string[];
  /** `NccdUnit.self_assessment_ar` of the lesson's unit, when printed per unit. */
  unitSelfAssessmentAr?: string[];
};

/** Shape compatible with Unit / Lesson in curriculumData.ts */
export type NccdBrowserUnit = {
  id: string;
  bookId: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  order: number;
};

export type NccdBrowserLesson = {
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
    /** See `LearningOutcome.examTargetSource` in catalog.ts. */
    examTargetSource?: 'main-idea' | 'self-assessment';
  }>;
};

export type NccdCatalog = {
  curriculum: NccdCurriculumFile;
  unitKbId: (jsonUnitId: string) => string;
  lessonKbId: (jsonLessonId: string) => string;
  findLessonByKbId: (kbLessonId: string) => NccdLesson | null;
  buildCatalog: () => { units: NccdKbUnit[]; lessons: NccdKbLesson[] };
  buildBrowserCatalog: () => { units: NccdBrowserUnit[]; lessons: NccdBrowserLesson[] };
};

/**
 * A lesson with no `periods` still has to occupy time on a timetable, so the
 * browser bills it as one 45-minute period. Named because the twenty-two
 * hand-written builders each inline `(lesson.periods ?? 1) * 45` and a reader
 * cannot tell whether the 1 is a default or a fact about that subject.
 */
const DEFAULT_PERIODS_WHEN_UNKNOWN = 1;
const MINUTES_PER_PERIOD = 45;

export function makeNccdCatalog(opts: {
  scope: CurriculumIdScope;
  /** Book id in KB_BOOKS (knowledgeBase.ts id space). */
  kbBookId: string;
  /** Book id in curriculumData.BOOKS (browser id space). */
  browserBookId: string;
  raw: unknown;
  /**
   * For a book that prints no outcomes list, give each lesson without
   * `objectives` exam-only targets taken from what the book DOES print for
   * that lesson: its own self-assessment box when it has one, otherwise its
   * «الفكرة الرئيسة». Without them the book has no objective at all, and an
   * evaluation — which is scoped by objectives — cannot target it
   * (`getEvaluableBookIds`). They live only in the browser lesson's
   * `outcomes`, tagged `examTargetSource`; `objectives` stays empty, so the
   * generator context still never calls them «النتاجات». Unit-level
   * self-assessment tables are not used here: the book does not say which
   * lesson a unit statement belongs to. Opt-in per book.
   */
  examTargetsFromBook?: boolean;
}): NccdCatalog {
  const { scope, kbBookId, browserBookId } = opts;
  const curriculum = opts.raw as NccdCurriculumFile;

  const examTargetsFor = (
    lesson: NccdLesson,
  ): Array<{ text: string; source: 'main-idea' | 'self-assessment' }> => {
    if (!opts.examTargetsFromBook) return [];
    const own = (lesson.self_assessment_ar ?? []).filter(s => s.trim());
    if (own.length > 0) return own.map(text => ({ text, source: 'self-assessment' as const }));
    const idea = lesson.main_idea_ar?.trim();
    return idea ? [{ text: idea, source: 'main-idea' as const }] : [];
  };

  const unitKbId = (jsonUnitId: string): string => makeUnitKbId(scope, jsonUnitId);
  const lessonKbId = (jsonLessonId: string): string => makeLessonKbId(scope, jsonLessonId);

  const findLessonByKbId = (kbLessonId: string): NccdLesson | null => {
    const prefix = lessonKbPrefix(scope);
    if (!kbLessonId.startsWith(prefix)) return null;
    const jsonId = kbLessonId.slice(prefix.length);
    for (const u of curriculum.units) {
      const hit = u.lessons.find(l => l.id === jsonId);
      if (hit) return hit;
    }
    return null;
  };

  const buildCatalog = (): { units: NccdKbUnit[]; lessons: NccdKbLesson[] } => {
    const units: NccdKbUnit[] = curriculum.units.map(u => ({
      id: unitKbId(u.id),
      bookId: kbBookId,
      order: u.number,
      titleAr: u.title_ar,
      titleEn: u.title_en,
    }));

    const lessons: NccdKbLesson[] = [];
    for (const u of curriculum.units) {
      const uKbId = unitKbId(u.id);
      for (const lesson of u.lessons) {
        const vocab = lesson.vocabulary ?? [];
        const objectives = lesson.objectives ?? [];
        lessons.push({
          id: lessonKbId(lesson.id),
          unitId: uKbId,
          order: lesson.order,
          titleAr: lesson.title_ar,
          titleEn: lesson.title_en,
          summaryAr: lesson.main_idea_ar || `درس «${lesson.title_ar}» من وحدة «${u.title_ar}».`,
          summaryEn: lesson.main_idea_ar || `Lesson “${lesson.title_en}” from unit “${u.title_en}”.`,
          keyConceptsAr: vocab.map(v => v.ar),
          keyConceptsEn: vocab.map(v => v.en),
          keyTerms: vocab.map(v => ({ ar: v.ar, en: v.en, definitionAr: '', definitionEn: '' })),
          objectives: [...objectives],
          periods: lesson.periods ?? null,
          ...(lesson.self_assessment_ar?.length ? { selfAssessmentAr: [...lesson.self_assessment_ar] } : {}),
          ...(u.self_assessment_ar?.length ? { unitSelfAssessmentAr: [...u.self_assessment_ar] } : {}),
        });
      }
    }
    return { units, lessons };
  };

  const buildBrowserCatalog = (): {
    units: NccdBrowserUnit[];
    lessons: NccdBrowserLesson[];
  } => {
    const units: NccdBrowserUnit[] = curriculum.units.map(u => {
      const lessonTitles = u.lessons.map(l => l.title_ar).join(' · ');
      return {
        id: unitKbId(u.id),
        bookId: browserBookId,
        name: u.title_en,
        nameAr: u.title_ar,
        description: lessonTitles,
        descriptionAr: lessonTitles,
        order: u.number,
      };
    });

    const lessons: NccdBrowserLesson[] = [];
    for (const u of curriculum.units) {
      const uKbId = unitKbId(u.id);
      for (const lesson of u.lessons) {
        const objectives = [...(lesson.objectives ?? [])];
        const vocabulary = (lesson.vocabulary ?? []).map(v => v.ar);
        const lKbId = lessonKbId(lesson.id);
        lessons.push({
          id: lKbId,
          unitId: uKbId,
          title: lesson.title_en,
          titleAr: lesson.title_ar,
          estimatedDuration:
            (lesson.periods ?? DEFAULT_PERIODS_WHEN_UNKNOWN) * MINUTES_PER_PERIOD,
          objectives,
          objectivesAr: [...objectives],
          keywords: [...vocabulary],
          keywordsAr: [...vocabulary],
          teacherNotes: '',
          teacherNotesAr: '',
          // `bloomsLevel` is the builder's blanket value, not a judgement.
          // `isNccdObjectiveId` in curriculumIds.ts recognises ids minted here
          // so `objectives.ts` reports these as derived rather than authored —
          // the distinction three subjects lost on 2026-09-03 by being absent
          // from that check.
          outcomes: objectives.length > 0
            ? objectives.map((o, i) => ({
              id: objectiveId(scope, lesson.id, i),
              lessonId: lKbId,
              description: o,
              descriptionAr: o,
              bloomsLevel: 'Understand' as const,
              skills: [] as string[],
            }))
            : examTargetsFor(lesson).map((target, i) => ({
              // `-t` keeps these ids apart from `objectiveId(scope, lesson.id, i)`,
              // which real outcomes would take if the book ever prints them:
              // an exam stored against a target must never resolve to new text.
              id: objectiveId(scope, `${lesson.id}-t`, i),
              lessonId: lKbId,
              description: target.text,
              descriptionAr: target.text,
              bloomsLevel: 'Understand' as const,
              skills: [] as string[],
              examTargetSource: target.source,
            })),
        });
      }
    }
    return { units, lessons };
  };

  return { curriculum, unitKbId, lessonKbId, findLessonByKbId, buildCatalog, buildBrowserCatalog };
}
