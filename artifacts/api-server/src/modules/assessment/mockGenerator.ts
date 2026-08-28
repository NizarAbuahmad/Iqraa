/**
 * Deterministic evaluation generator — the DEMO_MODE path.
 *
 * What it will and will not do is the whole design. It builds questions from
 * real curriculum data: the objective's own wording supplies the subject, the
 * lesson's vocabulary supplies the key concepts a grader checks meaning
 * against. It does **not** invent subject content, which rules out four of the
 * eight types: multiple choice needs plausible distractors, true/false needs a
 * statement that is definitely true or false, matching needs real pairs, and
 * fill-in-the-blank needs a fact with a known missing word. Producing those
 * from a lesson title means writing plausible-looking questions that may not be
 * on the syllabus and may not have correct keys.
 *
 * The app already takes this line elsewhere — the quick-check generator falls
 * back to open questions "with no fabricated options" for non-maths topics, and
 * there is a test holding it there. This does the same, and reports the types
 * it declined so the teacher sees a shortfall rather than silently getting a
 * different evaluation than they asked for.
 *
 * Cognitive level comes from the *question*, not the objective. No objective in
 * the corpus is Remember and only 9 of 118 are Analyze or above, so inheriting
 * would make a four-competency breakdown impossible. Asking a recall question
 * about an Apply-level objective is ordinary practice and is what makes the
 * spread achievable.
 */
import {
  getLessonById,
  itemsForUnit,
  usePolicy,
  type CurriculumObjective,
  type CurriculumSource,
  type SourceKind,
} from "@workspace/curriculum";
import type { Difficulty, QuestionType } from "@workspace/db";
import {
  allocateQuestions,
  COMPETENCY_KEYS,
  MARKS_BY_COMPETENCY,
  type CompetencyKey,
} from "./competency.ts";
import { mockableTypes, QUESTION_TYPES } from "./questionTypes.ts";

export interface GeneratedQuestion {
  type: QuestionType;
  body: Record<string, unknown>;
  expectedAnswer: Record<string, unknown>;
  rubric: Record<string, unknown> | null;
  objectiveId: string;
  competencyKey: CompetencyKey;
  difficulty: Difficulty;
  marks: number;
  skill: string | null;
  gradingMode: string;
  aiMetadata: Record<string, unknown>;
}

export interface GenerationRequest {
  objectives: CurriculumObjective[];
  assessmentTypes: QuestionType[];
  count: number;
  difficulty: Difficulty;
  /**
   * Seeds the variation below. Omitted, one is drawn at random — two
   * generations of the same request then produce different papers, which is
   * what a teacher regenerating actually wants. The seed used is reported in
   * the result so `generationParams` can make the paper reproducible.
   */
  seed?: number;
}

export interface GenerationResult {
  questions: GeneratedQuestion[];
  /** The seed the variation ran on — store it to make the paper reproducible.
   *  Absent on the LLM path, whose variation is the model's own. */
  seed?: number;
  /** Requested types this generator will not fabricate. */
  unavailableTypes: QuestionType[];
  /** Set when fewer questions were produced than asked for. */
  shortfall: number;
  notes: string[];
  /**
   * What the knowledge bank holds for these objectives' units.
   *
   * A refusal on its own is a dead end: the teacher asked for multiple choice,
   * got told no, and is no closer to an exam. There are real question banks,
   * past papers and answer keys on file for most of these units, so the
   * refusal can end with where to look instead. It is not yet retrieval —
   * nothing has been extracted from those documents — and this is deliberately
   * shaped like the answer retrieval will give, so the seam is already here.
   */
  bankContext: BankContext;
}

/** Bank material scoped to the units the requested objectives belong to. */
export interface BankContext {
  /** Counts by kind, over the units in scope. */
  byKind: Partial<Record<SourceKind, number>>;
  /**
   * The documents most likely to supply the types this generator declined:
   * question banks first, then past papers, then answer keys.
   */
  suggested: Array<{
    id: string;
    title: string;
    kind: SourceKind;
    authorAr: string | null;
    usePolicy: "quotable" | "reference-only";
  }>;
  total: number;
  /**
   * How many of those documents nothing has been extracted from. Reported
   * because it is the whole distance between this and real retrieval — a
   * caller must not read `total` as "items we could serve".
   */
  pending: number;
  /** How many may not be reproduced. Counted, not estimated. */
  referenceOnly: number;
}

/** Kinds that could supply a real item, in the order worth reaching for. */
const ITEM_SOURCE_KINDS: readonly SourceKind[] = ["question-bank", "exam", "answer-key"];

/** English words for the note. The `kind` slugs are identifiers, not prose. */
const KIND_WORDS: Record<string, [one: string, many: string]> = {
  "question-bank": ["question bank", "question banks"],
  exam: ["past paper", "past papers"],
  "answer-key": ["answer key", "answer keys"],
};

/**
 * Summarise the bank for a set of objectives.
 *
 * Scoped by unit, because that is the granularity the bank is anchored at —
 * `objectiveIds` is empty on every document, and inventing an objective-level
 * claim from a unit tag is the mistake the manifest's own comments warn about.
 */
export function bankContextFor(objectives: readonly CurriculumObjective[]): BankContext {
  const byId = new Map<string, CurriculumSource>();
  for (const unitId of new Set(objectives.map(o => o.unitId))) {
    for (const item of itemsForUnit(unitId)) byId.set(item.id, item);
  }
  const items = [...byId.values()];

  const byKind: Partial<Record<SourceKind, number>> = {};
  for (const item of items) byKind[item.kind] = (byKind[item.kind] ?? 0) + 1;

  const suggested = items
    .filter(i => ITEM_SOURCE_KINDS.includes(i.kind))
    .sort((a, b) => ITEM_SOURCE_KINDS.indexOf(a.kind) - ITEM_SOURCE_KINDS.indexOf(b.kind)
      || a.title.localeCompare(b.title, "ar"))
    .slice(0, 5)
    .map(i => ({
      id: i.id,
      title: i.title,
      kind: i.kind,
      authorAr: i.authorAr,
      usePolicy: usePolicy(i),
    }));

  return {
    byKind,
    suggested,
    total: items.length,
    pending: items.filter(i => i.status === "pending").length,
    referenceOnly: items.filter(i => usePolicy(i) === "reference-only").length,
  };
}

/**
 * One sentence naming what exists, for the notes a teacher reads.
 *
 * Says the count rather than "most": the ratio of reference-only material
 * varies by unit, and a sentence that guesses at it is the kind of almost-true
 * claim this codebase has been bitten by.
 */
function bankNote(ctx: BankContext): string | null {
  if (!ctx.suggested.length) return null;
  const counts = ITEM_SOURCE_KINDS
    .map(k => {
      const n = ctx.byKind[k];
      if (!n) return null;
      const [one, many] = KIND_WORDS[k]!;
      return `${n} ${n === 1 ? one : many}`;
    })
    .filter(Boolean)
    .join(", ");
  const caveat = ctx.referenceOnly > 0
    ? ` ${ctx.referenceOnly} of the ${ctx.total} documents for these units are a named `
      + `teacher's own work and must not be reproduced verbatim.`
    : "";
  return `The library holds ${counts} for these units — real items to draw on, `
    + `but nothing has been extracted from them yet.${caveat}`;
}

/**
 * Deterministic PRNG (mulberry32). `Math.random` cannot be seeded, and an
 * unseedable generator would make "reproduce the paper a teacher reported"
 * impossible — the seed goes into `generationParams` for exactly that.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface StemVariant {
  stem: (topic: string) => string;
  modelAnswer: (topic: string) => string;
}

/**
 * Arabic stems by cognitive demand — the verb sets the level, as in the
 * corpus. Several phrasings per level, because a generator that words every
 * regeneration identically reads as broken to the teacher pressing the
 * button. Each stem is paired with the model answer that matches *its* ask;
 * mixing them independently would grade a summary against a definition.
 * All phrasings still only restate the objective — nothing here invents
 * subject content, which is this generator's whole contract.
 */
const STEM_VARIANTS: Record<CompetencyKey, StemVariant[]> = {
  knowledge: [
    {
      stem: t => `اذكر المفاهيم والمصطلحات الأساسية المتعلقة بـ: ${t}`,
      modelAnswer: t => `تشمل الإجابة الكاملة تسمية المفاهيم والمصطلحات الواردة في: ${t}`,
    },
    {
      stem: t => `عدّد أهم المصطلحات الواردة في: ${t}، وعرّف كلًّا منها بإيجاز.`,
      modelAnswer: t =>
        `تشمل الإجابة الكاملة تعداد مصطلحات: ${t}، مع تعريف موجز صحيح لكلٍّ منها.`,
    },
    {
      stem: t => `ما المفاهيم الأساسية التي يقوم عليها: ${t}؟ اذكرها.`,
      modelAnswer: t => `تشمل الإجابة الكاملة ذكر المفاهيم التي يقوم عليها: ${t}`,
    },
  ],
  understanding: [
    {
      stem: t => `اشرح بأسلوبك الخاص ما المقصود بـ: ${t}`,
      modelAnswer: t => `تشمل الإجابة الكاملة شرحًا بلغة الطالب لمعنى: ${t}`,
    },
    {
      stem: t => `وضّح بكلماتك معنى: ${t}، مع مثال يبيّن فهمك.`,
      modelAnswer: t =>
        `تشمل الإجابة الكاملة توضيحًا بلغة الطالب لمعنى: ${t}، مع مثال مناسب.`,
    },
    {
      stem: t => `لخّص الفكرة الرئيسة في: ${t} كما لو كنت تشرحها لزميل لك.`,
      modelAnswer: t => `تشمل الإجابة الكاملة تلخيصًا سليمًا بلغة الطالب للفكرة الرئيسة في: ${t}`,
    },
  ],
  application: [
    {
      stem: t => `طبّق ما تعلّمته: اعرض خطوات ${t}، مستعينًا بمثال من عندك.`,
      modelAnswer: t => `تشمل الإجابة الكاملة خطوات مرتّبة لتنفيذ: ${t}، مع مثال صحيح.`,
    },
    {
      stem: t => `نفّذ خطوات ${t} على مثال من اختيارك، مبيّنًا كل خطوة بوضوح.`,
      modelAnswer: t =>
        `تشمل الإجابة الكاملة تنفيذًا مرتّبًا لخطوات: ${t} على مثال صحيح من اختيار الطالب.`,
    },
    {
      stem: t => `استعمل ما تعلّمته في ${t} لحل مثال تكتبه بنفسك، مع إظهار الحل كاملًا.`,
      modelAnswer: t =>
        `تشمل الإجابة الكاملة مثالًا من إنشاء الطالب وحلًّا كاملًا صحيحًا يستعمل: ${t}`,
    },
  ],
  critical_thinking: [
    {
      stem: t => `حلّل الآتي: ${t}. بيّن متى يصلح هذا الأسلوب ومتى لا يصلح، مع تعليل إجابتك.`,
      modelAnswer: t => `تشمل الإجابة الكاملة تحليل: ${t}، مع تعليل واضح لحدود استعماله.`,
    },
    {
      stem: t => `قارن بين حالات يصلح فيها ${t} وحالات لا يصلح فيها، مع تعليل حكمك.`,
      modelAnswer: t =>
        `تشمل الإجابة الكاملة موازنة معلَّلة بين حالات صلاحية: ${t} وحدوده.`,
    },
    {
      stem: t => `ما نقاط القوة وما حدود الأسلوب المتّبع في: ${t}؟ علّل إجابتك.`,
      modelAnswer: t =>
        `تشمل الإجابة الكاملة بيان نقاط قوة: ${t} وحدوده، مع تعليل سليم.`,
    },
  ],
};

const DIFFICULTY_RUBRIC_AR: Record<CompetencyKey, string> = {
  knowledge: "ذكر المفاهيم الصحيحة",
  understanding: "وضوح الشرح ودقّته",
  application: "صحة الخطوات وسلامة المثال",
  critical_thinking: "عمق التحليل وقوة التعليل",
};

function buildRubric(competency: CompetencyKey, marks: number): Record<string, unknown> {
  const full = marks;
  const half = Math.max(1, Math.round(marks / 2));
  return {
    criteria: [
      {
        id: "c1",
        label_ar: DIFFICULTY_RUBRIC_AR[competency],
        marks: full,
        levels: [
          { marks: full, descriptor_ar: "إجابة كاملة وصحيحة" },
          { marks: half, descriptor_ar: "إجابة صحيحة جزئيًا تنقصها بعض العناصر" },
          { marks: 0, descriptor_ar: "إجابة غير صحيحة أو غير متصلة بالسؤال" },
        ],
      },
    ],
  };
}

/**
 * Key concepts an AI grader checks meaning against. Drawn from the lesson's own
 * vocabulary — real curriculum data — plus the objective's substantive words.
 * Grading against invented concepts would be worse than grading against none.
 */
function keyConceptsFor(objective: CurriculumObjective): string[] {
  const lesson = getLessonById(objective.lessonId);
  const vocabulary = (lesson?.keywordsAr?.length ? lesson.keywordsAr : lesson?.keywords) ?? [];
  const fromObjective = (objective.descriptionAr || objective.description)
    .split(/[\s،,.:]+/)
    .filter(w => w.length > 3)
    .slice(0, 6);
  return [...new Set([...vocabulary.slice(0, 6), ...fromObjective])].slice(0, 8);
}

/**
 * Open-response type best suited to a competency. Recall and comprehension fit
 * a short answer; application and analysis need room to show working.
 */
function pickType(
  competency: CompetencyKey,
  available: QuestionType[],
): QuestionType | null {
  const preference: Record<CompetencyKey, QuestionType[]> = {
    knowledge: ["short_answer", "open_ended", "problem_solving", "practical_task"],
    understanding: ["short_answer", "open_ended", "problem_solving", "practical_task"],
    application: ["problem_solving", "open_ended", "short_answer", "practical_task"],
    critical_thinking: ["open_ended", "problem_solving", "short_answer", "practical_task"],
  };
  return preference[competency].find(t => available.includes(t)) ?? null;
}

export function generateMockEvaluation(req: GenerationRequest): GenerationResult {
  const notes: string[] = [];
  const seed = req.seed ?? Math.floor(Math.random() * 0xffffffff);
  const rng = mulberry32(seed);
  const available = mockableTypes(req.assessmentTypes);
  const unavailableTypes = req.assessmentTypes.filter(t => !available.includes(t));

  if (req.objectives.length === 0) {
    return {
      questions: [],
      seed,
      unavailableTypes,
      shortfall: req.count,
      notes: ["No learning objectives were provided, so nothing could be generated."],
      // No objectives means no units, so nothing to scope the bank by. An
      // empty context, not the whole bank.
      bankContext: bankContextFor([]),
    };
  }

  const bankContext = bankContextFor(req.objectives);

  if (available.length === 0) {
    const pointer = bankNote(bankContext);
    return {
      questions: [],
      seed,
      unavailableTypes,
      shortfall: req.count,
      notes: [
        "None of the requested question types can be produced without inventing " +
          "subject content. Add an open-response type, write these questions by " +
          "hand, or switch the generator to a real model.",
        ...(pointer ? [pointer] : []),
      ],
      bankContext,
    };
  }

  if (unavailableTypes.length > 0) {
    notes.push(
      `Skipped ${unavailableTypes.join(", ")}: these need distractors or factual ` +
        `statements that cannot be derived from the curriculum text alone.`,
    );
    const pointer = bankNote(bankContext);
    if (pointer) notes.push(pointer);
  }

  const allocation = allocateQuestions(req.count, req.difficulty);
  const questions: GeneratedQuestion[] = [];

  // Round-robin the objectives so every one a teacher chose is actually
  // covered. Filling questions objective-by-objective would spend the whole
  // budget on the first one when the count is small. The order is shuffled
  // per generation (Fisher–Yates on the seeded rng): coverage is unchanged —
  // a full cycle still visits every objective — but which objective lands in
  // which competency slot differs between papers.
  const objectives = [...req.objectives];
  for (let i = objectives.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [objectives[i], objectives[j]] = [objectives[j]!, objectives[i]!];
  }

  let objectiveCursor = 0;
  for (const competency of COMPETENCY_KEYS) {
    const wanted = allocation[competency];
    const type = pickType(competency, available);
    if (!type) continue;

    // A random starting phrasing, then cycle: consecutive questions of the
    // same competency never share a stem wording, and regenerating re-rolls
    // the start. Cycling rather than drawing each one keeps near-duplicates
    // away from the validator's similarity gate.
    const variants = STEM_VARIANTS[competency];
    const variantOffset = Math.floor(rng() * variants.length);

    for (let i = 0; i < wanted; i += 1) {
      const objective = objectives[objectiveCursor % objectives.length]!;
      objectiveCursor += 1;
      const variant = variants[(variantOffset + i) % variants.length]!;

      const topic = objective.descriptionAr || objective.description;
      const marks = MARKS_BY_COMPETENCY[competency];
      const typeModule = QUESTION_TYPES[type];
      const needsRubric = typeModule.defaultGradingMode === "ai_rubric";

      const body: Record<string, unknown> = { prompt: variant.stem(topic) };
      if (type === "problem_solving") {
        body["scenario"] = `موقف صفّي مرتبط بـ: ${objective.lessonTitleAr || topic}`;
      }
      if (type === "practical_task") {
        body["materials"] = [];
        body["steps"] = [];
        body["submission"] = "text";
      }

      const expectedAnswer: Record<string, unknown> =
        type === "practical_task"
          ? { successCriteria: [DIFFICULTY_RUBRIC_AR[competency]] }
          : {
              modelAnswer: variant.modelAnswer(topic),
              keyConcepts: keyConceptsFor(objective),
            };

      questions.push({
        type,
        body,
        expectedAnswer,
        rubric: needsRubric ? buildRubric(competency, marks) : null,
        objectiveId: objective.id,
        competencyKey: competency,
        difficulty: req.difficulty,
        marks,
        skill: objective.skills?.[0] ?? null,
        gradingMode: typeModule.defaultGradingMode,
        aiMetadata: {
          generator: "mock",
          // Say plainly what this is. A teacher reviewing the evaluation should
          // not have to guess whether a model wrote the question.
          note: "template-derived from curriculum objective; not model-authored",
          objectiveBloomsSource: objective.bloomsSource,
          objectiveEffectiveBlooms: objective.effectiveBloomsLevel,
          generatedAt: new Date().toISOString(),
        },
      });
    }
  }

  const shortfall = req.count - questions.length;
  if (shortfall > 0) {
    notes.push(`Produced ${questions.length} of ${req.count} requested questions.`);
  }

  return { questions, seed, unavailableTypes, shortfall: Math.max(0, shortfall), notes, bankContext };
}
