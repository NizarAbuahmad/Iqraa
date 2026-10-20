/**
 * The pipeline behind `POST /generate/solve`: ask the model, then decide how
 * much of what it said may be called checked.
 *
 * The rules are the ones `keyVerification.ts` holds for exam keys, and they
 * exist for the same reasons:
 *
 * 1. `verified` is only ever the verifier's own word — `equivalent` — and only
 *    for the FINAL ANSWER. No step is checked and none is claimed to be.
 * 2. Only `distinct` is evidence against an answer. Anything else (undecided,
 *    unsupported, no check, a sleeping verifier) keeps the solution, unchecked.
 * 3. The model's reply is WHITELISTED into `{steps, answer, check}`. A model
 *    that writes `verified: true` is not stripped of it — it is never read.
 *
 * Two links stop a ✓ from attaching to the wrong thing. The answer the verifier
 * judged (`check.answer`) must be the answer shown. And when the typed problem
 * is Latin maths the shared classifier can read, the check must be about that
 * same problem — otherwise the model solved something else and the ✓ would be
 * for it. An Arabic prose problem cannot be classified; there the verified
 * solution carries `understoodAs`, the Latin problem actually checked, and the
 * teacher can see it.
 *
 * Pure: the model call and the verifier are injected, so every branch runs in a
 * test with no network. The route supplies the real ones.
 */
import {
  SOLUTION_LIMITS,
  classifyVerifiableTopic,
  cleanSolutionText,
  parseAnswerKeyCheck,
  parseSolution,
  type Solution,
  type SolveVerification,
} from "@workspace/math-verify";
import { isVerifierUnreachable } from "./derivativeVerified.ts";
import { UnusableGenerationError } from "./generationShape.ts";
import { solvePrompt } from "./solvePrompt.ts";
import type { RelateKeyFn } from "../modules/assessment/keyVerification.ts";

export type SolveDeps = {
  /** One model call: the reply parsed as JSON. Throws on a transport or shape failure. */
  complete: (userPrompt: string) => Promise<unknown>;
  relate: RelateKeyFn;
};

export type SolveResult = Solution & { verification: SolveVerification };
export type SolveOutcome = { ok: true; result: SolveResult } | { ok: false; reason: "no_solution" };

type Attempt =
  | { kind: "shown"; solution: Solution; verification: SolveVerification }
  | { kind: "contradicted"; computed: string | null; question: string };

const squash = (s: string): string => s.replace(/\s+/g, "");

async function attempt(problem: string, reply: unknown, relate: RelateKeyFn): Promise<Attempt> {
  const r =
    reply !== null && typeof reply === "object" && !Array.isArray(reply)
      ? (reply as Record<string, unknown>)
      : {};
  // The whitelist: only these three fields of the reply are ever read, and the
  // problem is the teacher's own text, not the model's restatement of it.
  const solution = parseSolution({ problem, steps: r["steps"], answer: r["answer"] });
  if (!solution) throw new UnusableGenerationError("solve", ["steps or answer unusable"]);

  const unchecked = (code: SolveVerification["code"]): Attempt => ({
    kind: "shown",
    solution,
    verification: { verified: false, source: "unchecked", code },
  });

  const rawCheck = r["check"];
  const check = parseAnswerKeyCheck(rawCheck);
  if (!check) return unchecked(rawCheck === undefined || rawCheck === null ? "no_check" : "unsupported");

  // (A check that merely restates its own answer — `P = 1/6` — never gets here:
  // `parseAnswerKeyCheck` refuses it, so it is 'unsupported' above.)

  // The verifier judges `check.answer`; the teacher is shown `answer`.
  if (squash(check.answer) !== squash(solution.answer)) return unchecked("unlinked");

  // When we can read the typed problem ourselves, the check must be about it.
  const heard = classifyVerifiableTopic(problem);
  if (heard && (heard.topic !== check.topic || squash(heard.payload) !== squash(check.question))) {
    return unchecked("restated");
  }

  const res = await relate(check.topic, check.question, check.answer);
  // A verifier that answers with something that is not an object is "could not
  // tell", never a crash and never a verdict.
  if (!res || typeof res !== "object") return unchecked("undecided");
  if (isVerifierUnreachable(res.error)) return unchecked("verifier_unreachable");

  if (res.relation === "equivalent") {
    const verification: SolveVerification = {
      verified: true,
      source: "sympy",
      code: "verified",
      understoodAs: check.question,
    };
    if (typeof res.computed_answer === "string") verification.computedAnswer = res.computed_answer;
    return { kind: "shown", solution, verification };
  }
  if (res.relation === "distinct") return { kind: "contradicted", computed: res.computed_answer, question: check.question };
  if (res.relation === "unsupported_topic") return unchecked("unsupported");
  return unchecked("undecided");
}

/**
 * Solve `problem` (already cleaned by the caller). Returns `no_solution` only
 * after the verifier contradicted the model twice, or contradicted it once and
 * the retry could not be verified — the first answer is known to be wrong, so
 * an unchecked second one is not good enough to show.
 */
export async function solveProblem(problem: string, isAr: boolean, deps: SolveDeps): Promise<SolveOutcome> {
  const first = await attempt(problem, await deps.complete(solvePrompt(problem, isAr)), deps.relate);
  if (first.kind === "shown") {
    return { ok: true, result: { ...first.solution, verification: first.verification } };
  }

  const target = cleanSolutionText(first.computed, SOLUTION_LIMITS.answer);
  if (target === null) return { ok: false, reason: "no_solution" };

  const second = await attempt(problem, await deps.complete(solvePrompt(problem, isAr, target, first.question)), deps.relate);
  if (second.kind === "shown" && second.verification.verified) {
    return { ok: true, result: { ...second.solution, verification: second.verification } };
  }
  return { ok: false, reason: "no_solution" };
}
