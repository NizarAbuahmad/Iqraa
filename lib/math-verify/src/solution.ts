/**
 * A worked solution as the whiteboard shows and stores it, and the one place
 * that decides whether a value IS one.
 *
 * Three callers must agree: the API (what it may send), the app (what it may
 * draw from a response) and the saved-board parser (what it may draw from
 * storage). Storage comes back from a server or a device, so it is untrusted,
 * and a second copy of these rules on either side is how a ✓ ends up on
 * something nothing checked. That is why this lives next to
 * `parseAnswerKeyCheck` rather than in either app.
 *
 * Text is REFUSED when it is over length, never truncated: cutting a step in
 * half can change what it says. `<` and `>` are allowed — inequalities are
 * maths — because every place that shows this text escapes or is inert.
 */

export const SOLUTION_LIMITS = {
  problem: 400,
  answer: 200,
  step: 300,
  minSteps: 1,
  maxSteps: 8,
  understoodAs: 200,
} as const;

export type Solution = { problem: string; steps: string[]; answer: string };

/** Why a final answer ended up checked or not — a value a UI can switch on. */
export type SolveVerificationCode =
  | 'verified'
  | 'no_check'
  | 'unsupported'
  | 'undecided'
  | 'verifier_unreachable'
  | 'unlinked'
  | 'restated';

export type SolveVerification = {
  verified: boolean;
  source: 'sympy' | 'unchecked';
  code: SolveVerificationCode;
  /** The Latin problem the verifier actually checked. Present on a verified solution. */
  understoodAs?: string;
  computedAnswer?: string;
};

/** What a board page stores. `verified` is about the FINAL ANSWER only. */
export type BoardSolution = Solution & {
  verified: boolean;
  source: 'sympy' | 'unchecked';
  understoodAs?: string;
};

/** Zero-width and bidi-formatting characters: they reorder or hide text and a solution never needs them. */
const INVISIBLE = /[\u061C\u00AD​-‏‪-‮⁠-⁯﻿]/g;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001F\u007F-\u009F]/;

/**
 * One line of clean text, or null. Whitespace (newlines and tabs included)
 * collapses to single spaces first, so the only control characters left are
 * the ones that are never legitimate.
 */
export function cleanSolutionText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();
  if (text.length === 0 || text.length > max) return null;
  if (CONTROL.test(text)) return null;
  return text;
}

/**
 * Read a solution, or null. Rebuilt field by field, so an unknown key — a
 * model's own `verified: true` above all — cannot ride along.
 */
export function parseSolution(raw: unknown): Solution | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const problem = cleanSolutionText(r['problem'], SOLUTION_LIMITS.problem);
  const answer = cleanSolutionText(r['answer'], SOLUTION_LIMITS.answer);
  if (problem === null || answer === null) return null;
  const rawSteps = r['steps'];
  if (
    !Array.isArray(rawSteps) ||
    rawSteps.length < SOLUTION_LIMITS.minSteps ||
    rawSteps.length > SOLUTION_LIMITS.maxSteps
  ) {
    return null;
  }
  const steps: string[] = [];
  for (const raw of rawSteps) {
    const step = cleanSolutionText(raw, SOLUTION_LIMITS.step);
    if (step === null) return null;
    steps.push(step);
  }
  return { problem, steps, answer };
}

/**
 * Read a stored board solution. The verified claim is held to the same rule it
 * is made under: verified ⇔ source `sympy`, and it must say what was checked.
 */
export function parseBoardSolution(raw: unknown): BoardSolution | null {
  const solution = parseSolution(raw);
  if (!solution) return null;
  const r = raw as Record<string, unknown>;
  const verified = r['verified'];
  const source = r['source'];
  if (typeof verified !== 'boolean') return null;
  if (source !== 'sympy' && source !== 'unchecked') return null;
  if (verified !== (source === 'sympy')) return null;
  const rawUnderstood = r['understoodAs'];
  if (verified) {
    const understoodAs = cleanSolutionText(rawUnderstood, SOLUTION_LIMITS.understoodAs);
    if (understoodAs === null) return null;
    return { ...solution, verified: true, source: 'sympy', understoodAs };
  }
  if (rawUnderstood !== undefined) return null;
  return { ...solution, verified: false, source: 'unchecked' };
}

/**
 * The board's form of a solution plus a verdict. Fails closed: anything short
 * of a sympy verdict that says what it checked is stored as unchecked.
 */
export function boardSolutionOf(solution: Solution, verification: SolveVerification): BoardSolution {
  const understoodAs =
    verification.understoodAs !== undefined
      ? cleanSolutionText(verification.understoodAs, SOLUTION_LIMITS.understoodAs)
      : null;
  const earned = verification.verified === true && verification.source === 'sympy' && understoodAs !== null;
  const base = { problem: solution.problem, steps: [...solution.steps], answer: solution.answer };
  return earned
    ? { ...base, verified: true, source: 'sympy', understoodAs }
    : { ...base, verified: false, source: 'unchecked' };
}
