/**
 * Real book questions on the live model path.
 *
 * The model writes the paper as it always has; this adds real NCCD questions
 * after it, deterministically, so they arrive word for word with their citation
 * and the model can neither reword them nor change their answers. The builder
 * itself is `bookQuestion` in `mockGenerator.ts`, shared with the mock path.
 *
 * Design: docs/superpowers/specs/2026-10-12-book-items-live-path-design.md.
 *
 * Ordering is the whole point of `assembleLivePaper`: the model's surplus is cut
 * BEFORE the book questions are added, so none of them is ever the one cut.
 */
import { bookItemsForLesson } from "@workspace/curriculum/bookItems";
import type { CurriculumObjective } from "@workspace/curriculum";
import type { Difficulty, QuestionType } from "@workspace/db";
import { MARKS_BY_COMPETENCY, type CompetencyKey } from "./competency.ts";
import { bookQuestion, type GeneratedQuestion } from "./mockGenerator.ts";

/**
 * Off unless exactly "true", like `AI_LIVE_MODE`, and read per request. Off by
 * default so merging changes nothing in production until a person has compared
 * the served items with the printed books.
 */
export function isBookItemsLiveOn(): boolean {
  return process.env["BOOK_ITEMS_LIVE"] === "true";
}

export interface BookPlanRequest {
  objectives: readonly CurriculumObjective[];
  assessmentTypes: readonly QuestionType[];
  /** The number of questions the teacher asked for. */
  count: number;
  subjectId: string | undefined;
  enabled: boolean;
  /** The paper's difficulty; it picks the tier the dry run draws from. Defaults to "standard". */
  difficulty?: Difficulty;
  /**
   * Book item ids the teacher has already been shown (a regeneration). The dry
   * run draws with them avoided, exactly as the real draw will: a lesson whose
   * only multiple-choice item was shown comes back as an exercise, and a plan
   * that ignored this would tell the model about a paper that will not exist.
   */
  avoidIds?: ReadonlySet<string>;
}

/**
 * Small seeded generator, so the dry run in `planBook` is the same every time.
 * Exported so a test can replay the dry run's own draw (seed `PLAN_SEED`).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * How many book questions this paper will carry, decided BEFORE the model is
 * asked so it can be asked for that many fewer. This is what the draw can
 * DELIVER, not how many items are eligible: two book items whose stems are
 * near-duplicates of each other are never both drawn (the validator would
 * reject the second), so counting raw items asks the model for too few
 * questions and the paper comes back short with the pool not exhausted. The
 * number comes from a dry run of the real draw with a fixed seed. It still
 * draws nothing for the paper. At most half the paper, as on the mock path.
 */
export function planBookDraw(req: BookPlanRequest): number {
  return planBook(req).k;
}

/** The seed of the dry run in `planBook`. */
export const PLAN_SEED = 1;

/**
 * What the dry run's book questions amount to. Nominal and approximate: the real
 * draw uses another seed and may differ by a question, so anything told to a
 * model from this says "about".
 */
export interface BookSupplied {
  byType: Partial<Record<"short_answer" | "multiple_choice", number>>;
  byCompetency: Partial<Record<CompetencyKey, number>>;
  marks: number;
}

/** Summarise drawn book questions from their own type, competency and marks. */
export function summariseBook(questions: readonly GeneratedQuestion[]): BookSupplied {
  const byType: BookSupplied["byType"] = {};
  const byCompetency: BookSupplied["byCompetency"] = {};
  let marks = 0;
  for (const q of questions) {
    if (q.type === "short_answer" || q.type === "multiple_choice") {
      byType[q.type] = (byType[q.type] ?? 0) + 1;
    }
    byCompetency[q.competencyKey] = (byCompetency[q.competencyKey] ?? 0) + 1;
    marks += q.marks;
  }
  return { byType, byCompetency, marks };
}

const NO_BOOK: BookSupplied = { byType: {}, byCompetency: {}, marks: 0 };

/**
 * `planBookDraw`'s dry run, keeping what it drew: `k` is the number of book
 * questions the paper will carry and `supplied` summarises them, so the prompt
 * can say what the model's share has to make up for. `k === 0` gives an empty
 * summary.
 */
export function planBook(req: BookPlanRequest): { k: number; supplied: BookSupplied } {
  const none = { k: 0, supplied: { ...NO_BOOK, byType: {}, byCompetency: {} } };
  if (!req.enabled || req.subjectId !== "mathematics") return none;
  const wantChoice = req.assessmentTypes.includes("multiple_choice");
  const wantShort = req.assessmentTypes.includes("short_answer");
  if (!wantChoice && !wantShort) return none;

  const lessons = new Set<string>();
  for (const o of req.objectives) if (o.lessonId) lessons.add(o.lessonId);
  let eligible = 0;
  for (const lessonId of lessons) {
    for (const item of bookItemsForLesson(lessonId)) {
      if (item.kind === "unit-test-mcq" ? wantChoice : wantShort) eligible += 1;
    }
  }
  const cap = Math.max(0, Math.min(Math.floor(req.count / 2), eligible));
  if (cap === 0) return none;
  const dry = drawBookQuestions({
    objectives: req.objectives,
    assessmentTypes: req.assessmentTypes,
    difficulty: req.difficulty ?? "standard",
    k: cap,
    accepted: [],
    ...(req.avoidIds ? { avoidIds: req.avoidIds } : {}),
    rng: mulberry32(PLAN_SEED),
  });
  const drawn = dry.slice(0, cap);
  return { k: drawn.length, supplied: summariseBook(drawn) };
}

/**
 * Competency and marks by kind. Nominal, and stated as such: the model chooses
 * these for its own questions, and a book item's cognitive demand is not read
 * from the book. Solving a system is application; picking the satisfying pair
 * is understanding.
 */
const SLOT: Record<"exercise" | "unit-test-mcq", CompetencyKey> = {
  exercise: "application",
  "unit-test-mcq": "understanding",
};
const liveSlot = (kind: "exercise" | "unit-test-mcq") => ({
  competency: SLOT[kind],
  marks: MARKS_BY_COMPETENCY[SLOT[kind]],
});

export interface BookDrawRequest {
  objectives: readonly CurriculumObjective[];
  assessmentTypes: readonly QuestionType[];
  difficulty: Difficulty;
  /** From `planBookDraw`. */
  k: number;
  /** The model's questions, so a book question is never a near-duplicate of one. */
  accepted: readonly GeneratedQuestion[];
  /** Book item ids the teacher has already been shown (a regeneration). */
  avoidIds?: ReadonlySet<string>;
  rng: () => number;
}

const idOf = (q: GeneratedQuestion) => String(q.aiMetadata["bookItemId"] ?? "");

/** Fisher–Yates on the supplied rng, so a seeded run is reproducible. */
function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function drawPass(
  req: BookDrawRequest,
  want: number,
  session: Set<string>,
  already: readonly GeneratedQuestion[],
): GeneratedQuestion[] {
  const wantChoice = req.assessmentTypes.includes("multiple_choice");
  const wantShort = req.assessmentTypes.includes("short_answer");
  const order = shuffled(req.objectives.filter(o => o.lessonId), req.rng);
  const out: GeneratedQuestion[] = [];
  while (out.length < want) {
    let drew = false;
    for (const objective of order) {
      if (out.length >= want) break;
      const q = bookQuestion({
        objective,
        difficulty: req.difficulty,
        slot: liveSlot,
        wantChoice,
        wantShort,
        session,
        rng: req.rng,
        accepted: [...already, ...out],
      });
      if (q) {
        out.push(q);
        drew = true;
      }
    }
    // A whole pass that drew nothing means the pools are spent: stop, short.
    if (!drew) break;
  }
  return out;
}

/**
 * Draw up to `k` book questions, round-robin over the objectives, never one that
 * the validator would reject as a near-duplicate of `accepted`. A regeneration
 * prefers items the teacher has not seen and falls back to repeats before it
 * would hand back a short paper: a repeated real question is acceptable.
 */
export function drawBookQuestions(req: BookDrawRequest): GeneratedQuestion[] {
  if (req.k <= 0) return [];
  const first = drawPass(req, req.k, new Set(req.avoidIds ?? []), req.accepted);
  if (first.length >= req.k || !req.avoidIds || req.avoidIds.size === 0) return first;
  const spent = new Set(first.map(idOf));
  const second = drawPass(req, req.k - first.length, spent, [...req.accepted, ...first]);
  return [...first, ...second];
}

export interface LivePaper {
  questions: GeneratedQuestion[];
  /** Model questions cut because the paper would otherwise exceed what was asked. */
  trimmed: number;
  drawn: number;
}

/**
 * The model's questions plus the book's, exactly `requested` long when the
 * model delivered. With `k === 0` the model's questions pass through UNTOUCHED,
 * so the flag being off is byte-for-byte the behaviour before this existed.
 *
 * Order: the book's questions come AFTER the model's here, and nothing in this
 * function sorts them. The route puts the finished paper into the ministry's type
 * blocks once, for every paper, with `inPaperOrder` (`paperOrder.ts`), after the
 * surplus trim; a second sort here would be a second copy of that rule. The
 * model's surplus is cut BEFORE the book questions are added, so with a book
 * share the paper cannot exceed `requested` and that trim cannot fire.
 */
export function assembleLivePaper(args: {
  modelQuestions: readonly GeneratedQuestion[];
  requested: number;
  k: number;
  draw: (accepted: readonly GeneratedQuestion[]) => GeneratedQuestion[];
}): LivePaper {
  if (args.k <= 0) return { questions: [...args.modelQuestions], trimmed: 0, drawn: 0 };
  const modelCap = Math.max(0, args.requested - args.k);
  const kept = args.modelQuestions.slice(0, modelCap);
  const book = args.draw(kept);
  return {
    questions: [...kept, ...book],
    trimmed: args.modelQuestions.length - kept.length,
    drawn: book.length,
  };
}

/** The book item ids a previous version of this paper carried. */
export function previousBookItemIds(
  previous: ReadonlyArray<{ aiMetadata: Record<string, unknown> | null }>,
): Set<string> {
  const ids = new Set<string>();
  for (const q of previous) {
    const id = q.aiMetadata?.["bookItemId"];
    if (typeof id === "string" && id) ids.add(id);
  }
  return ids;
}

/**
 * What a maths paper's `generationParams.bookItems` records. `supplied` is the
 * dry run's summary, `quota` the per-competency count the model was asked to
 * write (`supplied.newByCompetency`, the quota that was SENT, not one re-derived
 * later). With nothing planned there is no quota, and the key is left out.
 */
export function bookItemsRecord(args: {
  enabled: boolean;
  planned: number;
  supplied: BookSupplied;
  quota?: Readonly<Record<CompetencyKey, number>>;
  drawn: number;
  ids: ReadonlyArray<unknown>;
}): Record<string, unknown> {
  return {
    enabled: args.enabled,
    planned: args.planned,
    supplied: args.supplied,
    ...(args.planned > 0 && args.quota ? { quota: { ...args.quota } } : {}),
    drawn: args.drawn,
    ids: [...args.ids],
  };
}
