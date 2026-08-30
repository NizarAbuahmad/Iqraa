/**
 * Writing exam questions with a model.
 *
 * The mock generator beside this one is four Arabic sentence templates with an
 * objective title dropped in. It is honest about what it cannot do — it refuses
 * multiple choice, true/false, matching and fill-blank outright, because
 * plausible distractors and factual statements cannot be derived from an
 * objective's title without inventing subject content. Those four types are
 * exactly the ones that mark themselves, so until something can write them a
 * student link collects answers a teacher still has to mark by hand.
 *
 * This is that something. Three parts, split so the risky one is pure:
 *
 * - `buildGenerationPrompt` — what we ask for. Pure, so the contract with the
 *   model is readable and diffable rather than buried in a network call.
 * - `parseGeneratedQuestions` — what came back. Pure, and the part that has to
 *   assume the model is careless: this is where malformed items are dropped
 *   rather than allowed to reach the database.
 * - `generateWithModel` — the thin wrapper that actually calls out.
 *
 * **Nothing here decides whether a question is good enough to keep.** Output
 * goes to `validateGenerated`, the same gate the mock passes through, which
 * enforces objective scope, requested types, per-type structure, positive
 * marks and near-duplicate stems. A model that returns something plausible but
 * off-syllabus is rejected there, by rules that already existed.
 */
import type { CurriculumObjective } from "@workspace/curriculum";
import type { Difficulty, QuestionType } from "@workspace/db";
import { QUESTION_TYPES } from "./questionTypes.ts";
import { VERIFIABLE_TOPICS, parseAnswerKeyCheck } from "@workspace/math-verify";
import { competencyForBlooms, type CompetencyKey } from "./competency.ts";
import type { GeneratedQuestion } from "./mockGenerator.ts";

/** Bumped when the prompt changes shape, so usage rows stay comparable. */
export const GENERATION_PROMPT_VERSION = "exam-gen-4";

export interface LlmGenerationRequest {
  objectives: CurriculumObjective[];
  assessmentTypes: QuestionType[];
  count: number;
  difficulty: Difficulty;
  language: string;
  /**
   * Verbatim pages from the official textbook for these objectives, already
   * formatted and cited — see `lib/grounding.ts`.
   *
   * Optional, and absent is the common case: only six of the bank's 78
   * documents have been read. A question written from an objective's title
   * alone is what this exists to improve on, not to replace — the model is
   * asked to prefer the book's own numbers and phrasing when there is a book.
   */
  bookExcerpts?: string;
}

/**
 * The exact JSON shape each type must come back as.
 *
 * Spelled out per type rather than described in prose because the structural
 * rules in `questionTypes.ts` are unforgiving — an MCQ needs three or more
 * options with unique text and a correct id that exists — and a question that
 * fails them is thrown away after we have already paid for it.
 */
export const TYPE_CONTRACTS: Partial<Record<QuestionType, string>> = {
  multiple_choice:
    '{"type":"multiple_choice","body":{"stem":"…","multiSelect":false,' +
    '"options":[{"id":"a","text":"…"},{"id":"b","text":"…"},{"id":"c","text":"…"},{"id":"d","text":"…"}]},' +
    '"expectedAnswer":{"optionIds":["b"]}}  — 4 options, all different, exactly one correct, ' +
    "and every distractor must be a mistake a student could actually make",
  true_false:
    '{"type":"true_false","body":{"statement":"…"},"expectedAnswer":{"value":false}}' +
    "  — a statement that is unambiguously true or false, never a matter of opinion",
  matching:
    '{"type":"matching","body":{"left":[{"id":"l1","text":"…"}],"right":[{"id":"r1","text":"…"}]},' +
    '"expectedAnswer":{"pairs":[{"left":"l1","right":"r1"}]}}  — every left item needs exactly one pair',
  fill_blank:
    '{"type":"fill_blank","body":{"template":"… {{1}} … {{2}} …"},' +
    '"expectedAnswer":{"blanks":[{"accept":["…","…"]},{"accept":["…"]}]}}' +
    "  — one entry in blanks per {{n}}, and accept must list every spelling a correct student might write",
  // These four are graded by a human (practical_task) or, once Tier 3 exists,
  // an AI rubric grader (the other three) — never by `questionTypes.ts`'s own
  // `grade()`, which none of them define. All three ai_rubric types need
  // `modelAnswer` and `keyConcepts` in `expectedAnswer`: the same fields the
  // mock generator always fills in, and — unlike the four contracts above —
  // not optional. `validateGenerated` calls each type's own `validate()`
  // before anything is persisted, and `questionTypes.ts`'s shared open-response
  // validator rejects any question missing either field, model-written or
  // not. A contract that omits them (as this one used to for all three) is
  // not a smaller ask — it is asking the model to write a question that
  // cannot pass the gate that already exists for it.
  short_answer:
    '{"type":"short_answer","body":{"prompt":"…"},' +
    '"expectedAnswer":{"modelAnswer":"…","keyConcepts":["…","…"]},' +
    '"rubric":{"criteria":[{"label":"…","marks":2}]}}',
  open_ended:
    '{"type":"open_ended","body":{"prompt":"…"},' +
    '"expectedAnswer":{"modelAnswer":"…","keyConcepts":["…","…"]},' +
    '"rubric":{"criteria":[{"label":"…","marks":2}]}}',
  problem_solving:
    '{"type":"problem_solving","body":{"prompt":"…","scenario":"…"},' +
    '"expectedAnswer":{"modelAnswer":"…","keyConcepts":["…","…"]},' +
    '"rubric":{"criteria":[{"label":"…","marks":2}]}}',
  // Graded manually against successCriteria, never by an AI rubric — a
  // rubric example here would be as misleading as omitting successCriteria
  // is disqualifying, since `practicalTask.validate()` requires the latter
  // and never looks for the former.
  practical_task:
    '{"type":"practical_task","body":{"prompt":"…"},' +
    '"expectedAnswer":{"successCriteria":["…","…"]}}' +
    "  — no rubric; a teacher marks this by hand against the success criteria",
};

const DIFFICULTY_NOTE: Record<Difficulty, string> = {
  basic: "Lean on recall and comprehension. A well-prepared student should find most of it straightforward.",
  standard: "A balanced paper: some recall, most application, a little analysis.",
  advanced: "Weight towards application and analysis. Recall alone should not pass it.",
};

/**
 * Is this a mathematics paper?
 *
 * Matched on `subjectId`, never on the subject's display name. CLAUDE.md
 * records the name-matching version of this question as a repeat offender —
 * `isMathContext` tests a string, so a mislabelled subject serves maths
 * questions under a chemistry title. An id is not a display string, does not
 * localise, and cannot drift.
 *
 * Used to decide whether the prompt insists on a machine-checkable key: the
 * verifier only proves derivatives, circles and equations, so asking a
 * chemistry paper for one would produce keys it must then refuse.
 */
export function paperIsMathematics(objectives: readonly CurriculumObjective[]): boolean {
  return objectives.some(o => o.subjectId === "mathematics");
}

export function buildGenerationPrompt(req: LlmGenerationRequest): {
  system: string;
  user: string;
} {
  const arabic = req.language !== "en";
  const contracts = req.assessmentTypes
    .map(t => `- ${t}: ${TYPE_CONTRACTS[t] ?? "{}"}`)
    .join("\n");
  const objectives = req.objectives
    .map(o => `- id "${o.id}": ${o.descriptionAr || o.description}`)
    .join("\n");
  // Only a maths paper gets pushed on the check block: those are the topics the
  // verifier can actually prove.
  const isMaths = paperIsMathematics(req.objectives);

  const system = [
    "You write exam questions for the Jordanian national curriculum, Grade 10.",
    arabic
      ? "Every question you write is in Modern Standard Arabic, as a Jordanian teacher would phrase it "
        + "for their own class. Use Arabic mathematical notation and Arabic-Indic digits where a teacher "
        + "would — in the text a student reads. The \"check\" field described below is never shown to a "
        + "student: it is read by a computer algebra system, and it is always Latin."
      : "Write in clear English.",
    "",
    "Rules you do not break:",
    "1. Every question measures one of the listed objectives, and carries that objective's exact id. Nothing outside them.",
    "2. You only produce the question types listed. Never substitute a different type.",
    "3. Distractors are plausible wrong answers a real student would pick — never filler, never obviously absurd, never 'none of the above'.",
    "4. Never write a question whose answer is a matter of opinion unless the type is open_ended.",
    "5. Do not repeat yourself. Two questions that test the same fact in the same way are one question.",
    "6. Whenever a question's answer is symbolic — an expression, a value, a solution set, a point — you "
      + "include \"check\", in Latin notation. It is verified by a computer algebra system before any "
      + "teacher sees the question, so a key you are not sure of is worth more to us checked than omitted. "
      + "Written in Arabic it cannot be checked at all, and the question goes out unverified.",
    ...(isMaths
      ? [
        "7. This is a mathematics paper. Every question here whose answer is an expression, a value, a "
          + "solution set or a point has a \"check\" — that is most of them. A maths question without one "
          + "is a question nobody can verify.",
      ]
      : []),
    "",
    "Return JSON only: {\"questions\": [ … ]}. No prose, no markdown fence.",
  ].join("\n");

  const user = [
    `Write ${req.count} questions.`,
    "",
    "Objectives (use these ids verbatim):",
    objectives,
    "",
    // Before the type contracts, not after: this is what the questions are
    // *about*, and a model that has read the contracts first tends to write to
    // the shape and treat the content as decoration.
    ...(req.bookExcerpts
      ? [
        req.bookExcerpts,
        "",
        "Prefer the book's own worked values, notation and vocabulary over inventing your own. "
          + "Do not write a question about something the excerpts do not cover unless an objective requires it.",
        "",
      ]
      : []),
    "Allowed types and the exact JSON each must use:",
    contracts,
    "",
    `Difficulty: ${req.difficulty}. ${DIFFICULTY_NOTE[req.difficulty]}`,
    "",
    "Each question object also needs:",
    '  "objectiveId": one of the ids above',
    '  "competencyKey": one of knowledge | understanding | application | critical_thinking —',
    "    the cognitive demand of THIS question, which is not the same as its objective's level.",
    "    A recall question about an application objective is knowledge.",
    '  "marks": a positive number, larger for questions that demand more work',
    '  "skill": a two-to-four word label for what it actually tests, or null',
    "",
    // The stem stays Arabic for the class; this is the same maths in the only
    // notation SymPy reads. Optional on purpose — a question with no symbolic
    // answer must not be forced to invent one, and an absent check costs the
    // question nothing beyond going out unverified.
    'When the answer is something a computer algebra system can check, include:',
    '  "check": {"topic": …, "question": …, "answer": …} — all in LATIN notation (x, 0-9), never Arabic.',
    `    topic is one of: ${VERIFIABLE_TOPICS.join(" | ")}`,
    '    question is the payload the topic needs: the expression for a derivative ("x^3 - 4x"),',
    '      the expression and point separated by @ for derivative_at_point ("x^4@2"),',
    '      the equation for an equation topic ("2x + 5 = 13") or a circle ("(x-4)^2 + (y+1)^2 = 9").',
    '    answer is your key in latin form ("3x^2 - 4", "x = 4", "(4, -1)").',
    // The permission to omit stays, and is deliberately narrow. A model
    // badgered into inventing a check for an essay question would produce a
    // key the verifier then judges — which is a worse outcome than no key.
    '    Omit "check" only when the answer is prose, a definition, or otherwise not symbolic.',
    // One complete object beats three paragraphs describing one. It exists
    // mainly to show the two notations sitting side by side in a single
    // question — Arabic in the stem a student reads, Latin in the field the
    // machine reads — which is the exact distinction the rules above are
    // asking the model to hold.
    ...(isMaths
      ? [
        "",
        "A complete example of a maths question, showing the Arabic a student reads and the Latin the",
        "verifier reads in the same object:",
        '{"type":"short_answer","objectiveId":"<one of the ids above>","competencyKey":"application",'
          + '"marks":3,"skill":"اشتقاق كثيرة حدود",'
          + '"body":{"prompt":"أوجد مشتقة الاقتران ق(س) = س³ − ٤س"},'
          + '"expectedAnswer":{"modelAnswer":"المشتقة هي ٣س² − ٤","keyConcepts":["المشتقة","كثيرة الحدود"]},'
          + '"rubric":{"criteria":[{"label":"صحة الاشتقاق","marks":3}]},'
          + '"check":{"topic":"derivative_polynomial","question":"x^3 - 4x","answer":"3x^2 - 4"}}',
      ]
      : []),
  ].join("\n");

  return { system, user };
}

const COMPETENCIES: readonly CompetencyKey[] = [
  "knowledge",
  "understanding",
  "application",
  "critical_thinking",
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export interface ParseResult {
  questions: GeneratedQuestion[];
  /** Items the model returned that could not be used, and why. */
  discarded: { index: number; reason: string }[];
}

/**
 * Turn whatever the model returned into questions, discarding what cannot be
 * used.
 *
 * Deliberately forgiving about *shape* and strict about *substance*: a missing
 * `skill` is filled in, an unknown competency falls back to the objective's
 * Bloom's level, but a question with no objective id, an unrequested type, or
 * no marks is dropped here rather than sent on to be rejected later with a
 * worse error message.
 *
 * Everything that survives still faces `validateGenerated`. This function is
 * not a quality gate; it is a shape gate.
 */
export function parseGeneratedQuestions(
  raw: unknown,
  req: LlmGenerationRequest,
  meta: { model: string },
): ParseResult {
  const root = asRecord(raw);
  const list = Array.isArray(root?.["questions"]) ? (root!["questions"] as unknown[]) : [];
  const allowedTypes = new Set<string>(req.assessmentTypes);
  const objectivesById = new Map(req.objectives.map(o => [o.id, o]));

  const questions: GeneratedQuestion[] = [];
  const discarded: { index: number; reason: string }[] = [];

  list.forEach((item, index) => {
    const drop = (reason: string): void => {
      discarded.push({ index, reason });
    };
    const q = asRecord(item);
    if (!q) return drop("not an object");

    const type = String(q["type"] ?? "");
    if (!allowedTypes.has(type)) return drop(`type "${type}" was not requested`);
    const typeModule = QUESTION_TYPES[type as QuestionType];
    if (!typeModule) return drop(`unknown type "${type}"`);

    const objectiveId = String(q["objectiveId"] ?? "");
    const objective = objectivesById.get(objectiveId);
    // Scope is checked again in the validator; catching it here means the
    // discard carries a reason a human can read, instead of a rejection index.
    if (!objective) return drop(`objective "${objectiveId}" is not in this evaluation`);

    const body = asRecord(q["body"]);
    if (!body) return drop("body is missing");

    const marks = Number(q["marks"]);
    if (!Number.isFinite(marks) || marks <= 0) return drop("marks must be a positive number");

    const competencyRaw = String(q["competencyKey"] ?? "");
    const competencyKey = COMPETENCIES.includes(competencyRaw as CompetencyKey)
      ? (competencyRaw as CompetencyKey)
      // The objective's own Bloom's level is a poor substitute — see
      // competency.ts on why demand is not inherited — but it beats dropping a
      // question that is otherwise sound over one missing string.
      : competencyForBlooms(objective.effectiveBloomsLevel);

    const skill = typeof q["skill"] === "string" && q["skill"].trim() ? q["skill"].trim() : null;

    // Absent or malformed both give null, and neither is an error: a question
    // with no symbolic answer is the normal case, and a broken check costs the
    // question only its chance at being verified, never its place in the paper.
    const check = parseAnswerKeyCheck(q["check"]);

    questions.push({
      type: type as QuestionType,
      body,
      expectedAnswer: asRecord(q["expectedAnswer"]) ?? {},
      rubric: asRecord(q["rubric"]),
      objectiveId,
      competencyKey,
      difficulty: req.difficulty,
      marks: Math.round(marks * 100) / 100,
      skill,
      gradingMode: typeModule.defaultGradingMode,
      check,
      // Provenance, so a question can always answer "where did you come from".
      // `evaluations.generator` records the same at the evaluation level.
      aiMetadata: {
        model: meta.model,
        promptVersion: GENERATION_PROMPT_VERSION,
        source: "llm",
      },
    });
  });

  return { questions, discarded };
}

export interface LlmGenerationResult extends ParseResult {
  model: string;
  notes: string[];
}

/**
 * Ask the model, and hand back what it said.
 *
 * `callModel` is injected so the parsing and prompt above can be tested without
 * a network or a key, and so the route keeps ownership of budget guards and
 * usage recording — this module does not decide whether spending is allowed.
 */
export async function generateWithModel(
  req: LlmGenerationRequest,
  callModel: (prompt: { system: string; user: string }) => Promise<{ parsed: unknown; model: string }>,
): Promise<LlmGenerationResult> {
  const prompt = buildGenerationPrompt(req);
  const { parsed, model } = await callModel(prompt);
  const result = parseGeneratedQuestions(parsed, req, { model });

  const notes: string[] = [];
  if (result.discarded.length > 0) {
    // Said out loud rather than swallowed: a teacher who asked for 15 and got
    // 11 is owed the reason, and silently short papers are how a generator's
    // decline goes unnoticed.
    notes.push(
      `Discarded ${result.discarded.length} malformed question(s) from the model: ` +
        result.discarded.map(d => `#${d.index + 1} ${d.reason}`).join("; "),
    );
  }
  return { ...result, model, notes };
}
