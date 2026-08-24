/**
 * Paper exams — an exam the app did not write.
 *
 * A teacher who set their own paper does not need the app to hold the question
 * text; the paper has it. What the app needs is one row per question: how many
 * marks it carries, which objective it measures, and what cognitive demand it
 * makes. That is enough to mark it, score it, and say afterwards which
 * objectives the class is weak on.
 *
 * Two fields are required rather than inferred, and both cost the teacher a tap:
 *
 * - **`objectiveId`**, because an unscoped question measures nothing. Every
 *   downstream answer to "what should I reteach" keys off it.
 * - **`competencyKey`**, because `competency.ts` is explicit that a question's
 *   cognitive demand is not its objective's: inheriting it produces an
 *   evaluation that is half Understanding, half Application and nothing else.
 *   Defaulting it in the UI is a convenience the teacher can override; deriving
 *   it here would remove the choice entirely and quietly flatten the breakdown.
 */
import { COMPETENCY_KEYS, type CompetencyKey } from "./competency.ts";
import type { Difficulty } from "@workspace/db";

export interface PaperRow {
  marks: number;
  objectiveId: string;
  competencyKey: CompetencyKey;
  difficulty: Difficulty;
}

export type PaperParse =
  | { ok: true; rows: PaperRow[] }
  | { ok: false; error: string; index?: number };

const DIFFICULTIES: readonly Difficulty[] = ["basic", "standard", "advanced"];

/** One question cannot be worth more than a whole reasonable paper. */
export const MAX_MARKS_PER_QUESTION = 100;

export function parsePaperRows(
  raw: unknown,
  opts: { allowedObjectiveIds: readonly string[]; maxQuestions: number },
): PaperParse {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: "Add at least one question" };
  }
  if (raw.length > opts.maxQuestions) {
    return { ok: false, error: `A paper exam can hold at most ${opts.maxQuestions} questions` };
  }

  const rows: PaperRow[] = [];
  for (const [index, item] of raw.entries()) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "Each question must be an object", index };
    }
    const row = item as Record<string, unknown>;

    const rawMarks = row["marks"];
    const text = typeof rawMarks === "string" ? rawMarks.trim() : null;
    const marks = typeof rawMarks === "number" ? rawMarks : text ? Number(text) : NaN;
    // Zero marks is not a lenient question, it is not a question — it can never
    // move the score, so it would sit in the paper looking like evidence.
    if (!Number.isFinite(marks) || marks <= 0 || marks > MAX_MARKS_PER_QUESTION) {
      return {
        ok: false,
        error: `Marks must be greater than 0 and at most ${MAX_MARKS_PER_QUESTION}`,
        index,
      };
    }

    const objectiveId = typeof row["objectiveId"] === "string" ? row["objectiveId"].trim() : "";
    if (!objectiveId || !opts.allowedObjectiveIds.includes(objectiveId)) {
      return { ok: false, error: "Each question needs an objective from this evaluation", index };
    }

    const competencyKey = row["competencyKey"];
    if (!COMPETENCY_KEYS.includes(competencyKey as CompetencyKey)) {
      return { ok: false, error: "Each question needs a competency", index };
    }

    const difficulty = DIFFICULTIES.includes(row["difficulty"] as Difficulty)
      ? (row["difficulty"] as Difficulty)
      : "standard";

    rows.push({
      marks: Math.round(marks * 100) / 100,
      objectiveId,
      competencyKey: competencyKey as CompetencyKey,
      difficulty,
    });
  }

  return { ok: true, rows };
}

/**
 * A question whose content lives on paper rather than in the app.
 *
 * Publishing validates each question's body against its type — a prompt, the
 * right number of options, an answer key. A paper question has none of that by
 * design, so those checks would block a paper exam from ever being published
 * for failing to contain something it was never given.
 *
 * Deliberately keyed on the body being *empty* rather than on
 * `source === 'teacher'`: a hand-written question that does carry its own text
 * still gets validated like any other. The exemption is "there is nothing here
 * to check", not "a teacher wrote it".
 */
export function isPaperQuestion(q: {
  gradingMode: string;
  body: Record<string, unknown> | null | undefined;
}): boolean {
  return q.gradingMode === "manual" && Object.keys(q.body ?? {}).length === 0;
}
