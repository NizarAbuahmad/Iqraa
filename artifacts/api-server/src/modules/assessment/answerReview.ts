/**
 * «راجع إجاباتك»: after an exam, each question with the student's answer, the
 * correct one and — for maths, once the teacher has prepared them — the steps.
 *
 * Until this existed a released result was a level and a percentage, and a
 * student could not find out which questions they got wrong.
 *
 * **The answer key leaves the server only through here**, and only when three
 * things hold (`studentReviewReady`): the teacher released the results, the
 * teacher turned the review on, and the exam is closed. Closed is the part
 * that protects the key: an open exam is still being sat, and a retake is
 * offered only while it is open. That is also why turning the review on needs
 * a closed exam (`solutionsDecision`) and re-publishing turns it off.
 *
 * Answers go out as display text built here, never as the raw `expectedAnswer`
 * or `rubric`: the screen needs a sentence, and a raw key carries grading
 * fields (`accept` lists, key concepts) nobody decided to show.
 *
 * Pure: the route fetches plain rows.
 */
import { studentResultReady } from "./studentView.ts";

export type SolutionsDecision =
  | { ok: true; shown: boolean }
  | { ok: false; status: 400 | 409; code: "invalid_input" | "not_closed"; error: string };

/** May the teacher turn the review on (or off)? Off is always allowed. */
export function solutionsDecision(evaluation: { status: string }, body: unknown): SolutionsDecision {
  const shown = body && typeof body === "object" ? (body as Record<string, unknown>)["shown"] : undefined;
  if (typeof shown !== "boolean") {
    return { ok: false, status: 400, code: "invalid_input", error: "shown must be true or false" };
  }
  if (shown && evaluation.status !== "closed") {
    return { ok: false, status: 409, code: "not_closed", error: "Close the evaluation before showing its answers" };
  }
  return { ok: true, shown };
}

export function studentReviewReady(opts: {
  status: string;
  released: boolean;
  solutionsShown: boolean;
  result: { isProvisional: boolean } | undefined;
}): boolean {
  return (
    opts.status === "closed" &&
    opts.solutionsShown &&
    studentResultReady({ released: opts.released, result: opts.result })
  );
}

export interface ReviewQuestion {
  id: string;
  type: string;
  marks: unknown;
  body: Record<string, unknown> | null | undefined;
  expectedAnswer: Record<string, unknown> | null | undefined;
}

export interface ReviewItem {
  questionId: string;
  number: number;
  type: string;
  /** The body the student was shown, for the screen's own question text. */
  body: Record<string, unknown>;
  yourAnswer: string | null;
  correctAnswer: string | null;
  awardedMarks: number | null;
  maxMarks: number;
  verdict: string | null;
  steps: string[] | null;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const joined = (parts: string[]): string | null => (parts.length > 0 ? parts.join("\n") : null);

function optionTexts(body: Record<string, unknown>, ids: unknown[]): string[] {
  const byId = new Map(list(body["options"]).map(o => [str(rec(o)["id"]), str(rec(o)["text"])]));
  return ids.map(id => byId.get(str(id)) ?? "").filter(Boolean);
}

function matchingLines(body: Record<string, unknown>, pairs: unknown[]): string[] {
  const text = (side: string) => new Map(list(body[side]).map(x => [str(rec(x)["id"]), str(rec(x)["text"])]));
  const left = text("left");
  const right = text("right");
  return pairs
    .map(p => {
      const l = left.get(str(rec(p)["left"]));
      const r = right.get(str(rec(p)["right"]));
      return l && r ? `${l} ← ${r}` : "";
    })
    .filter(Boolean);
}

const trueFalse = (v: unknown, isAr: boolean): string | null =>
  typeof v === "boolean" ? (v ? (isAr ? "صح" : "True") : isAr ? "خطأ" : "False") : null;

/** The correct answer as one display string, or null for a type that has none (read aloud). */
export function correctAnswerText(q: ReviewQuestion, isAr: boolean): string | null {
  const body = rec(q.body);
  const key = rec(q.expectedAnswer);
  switch (q.type) {
    case "multiple_choice":
      return joined(optionTexts(body, list(key["optionIds"])));
    case "dictation":
      return str(body["mode"]) === "choice"
        ? joined(optionTexts(body, list(key["optionIds"])))
        : str(key["text"]) || null;
    case "true_false":
      return trueFalse(key["value"], isAr);
    case "matching":
      return joined(matchingLines(body, list(key["pairs"])));
    case "fill_blank":
      // The first accepted spelling of each blank is the one the key was written with.
      return joined(list(key["blanks"]).map(b => str(list(rec(b)["accept"])[0])).filter(Boolean));
    case "practical_task":
      return joined(list(key["successCriteria"]).map(c => str(typeof c === "string" ? c : rec(c)["text"])).filter(Boolean));
    case "read_aloud":
      return null;
    default:
      // short_answer, open_ended, problem_solving
      return str(key["modelAnswer"]) || null;
  }
}

/** What the student answered, as one display string, or null when they left it. */
export function yourAnswerText(q: ReviewQuestion, response: Record<string, unknown> | undefined, isAr: boolean): string | null {
  const body = rec(q.body);
  const r = rec(response);
  switch (q.type) {
    case "multiple_choice":
      return joined(optionTexts(body, list(r["optionIds"])));
    case "dictation":
      return str(body["mode"]) === "choice" ? joined(optionTexts(body, list(r["optionIds"]))) : str(r["text"]) || null;
    case "true_false":
      return trueFalse(r["value"], isAr);
    case "matching":
      return joined(matchingLines(body, list(r["pairs"])));
    case "fill_blank":
      return joined(list(r["blanks"]).map(str).filter(Boolean));
    case "read_aloud":
      return str(r["transcript"]) || null;
    default:
      return str(r["text"]) || null;
  }
}

/**
 * One item per question of the paper the student sat — the attempt's
 * snapshot, in its order — so the review shows what they were asked even if
 * the exam was edited afterwards. Steps come from the live question by id.
 */
export function reviewItems(input: {
  snapshot: ReviewQuestion[];
  answers: { questionId: string; response: Record<string, unknown> }[];
  grades: { questionId: string; awardedMarks: unknown; maxMarks: unknown; verdict: string }[];
  stepsById: Map<string, string[] | null>;
  isAr: boolean;
}): ReviewItem[] {
  const answerOf = new Map(input.answers.map(a => [a.questionId, a.response]));
  const gradeOf = new Map(input.grades.map(g => [g.questionId, g]));
  return input.snapshot.map((q, i) => {
    const grade = gradeOf.get(q.id);
    const steps = input.stepsById.get(q.id);
    return {
      questionId: q.id,
      number: i + 1,
      type: q.type,
      body: rec(q.body),
      yourAnswer: yourAnswerText(q, answerOf.get(q.id), input.isAr),
      correctAnswer: correctAnswerText(q, input.isAr),
      awardedMarks: grade ? Number(grade.awardedMarks) : null,
      maxMarks: Number(grade?.maxMarks ?? q.marks) || 0,
      verdict: grade?.verdict ?? null,
      steps: Array.isArray(steps) && steps.length > 0 ? steps : null,
    };
  });
}
