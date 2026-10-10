/**
 * The app's side of «حلّ مسألة»: what it sends, what it accepts back, and which
 * message a failure earns.
 *
 * The response is validated again here even though the server already did: a
 * block can only draw what `parseSolution` accepts, and a ✓ only when the
 * verdict earns it (`boardSolutionOf` fails closed). Free of react-native so
 * `node --test` can load it.
 */
import {
  SOLUTION_LIMITS,
  boardSolutionOf,
  cleanSolutionText,
  parseSolution,
  type BoardSolution,
  type SolveVerification,
} from '@workspace/math-verify';

export type SolveRequest = { problem: string; language: 'arabic' | 'english' };

/** A solution the block may draw, or null. A verdict that is not earned is stored unchecked. */
export function acceptSolveResponse(raw: unknown): BoardSolution | null {
  const solution = parseSolution(raw);
  if (!solution) return null;
  const v = (raw as Record<string, unknown>)['verification'];
  const claim = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const understoodAs =
    typeof claim['understoodAs'] === 'string'
      ? cleanSolutionText(claim['understoodAs'], SOLUTION_LIMITS.understoodAs) ?? undefined
      : undefined;
  const verification: SolveVerification = {
    verified: claim['verified'] === true,
    source: claim['source'] === 'sympy' ? 'sympy' : 'unchecked',
    code: 'verified',
    ...(understoodAs !== undefined ? { understoodAs } : {}),
  };
  return boardSolutionOf(solution, verification);
}

/** The i18n key for a failed solve. Read off `code`, like `aiErrorMessageKey`. */
export function solveErrorKey(e: unknown): 'solveNoSolution' | 'solveAiOff' | 'aiQuotaSpent' | 'solveFailed' {
  const code = e && typeof e === 'object' ? (e as { code?: unknown }).code : undefined;
  if (code === 'no_solution') return 'solveNoSolution';
  if (code === 'live_mode_off') return 'solveAiOff';
  if (code === 'user_quota_exceeded' || code === 'budget_exceeded') return 'aiQuotaSpent';
  return 'solveFailed';
}
