/**
 * Which translation a student sees for an error the exam route answered.
 *
 * The route's `error` strings are English; this app is Arabic-first and the
 * screen used to print them as they came. Branch on `code` (and on the one
 * status that carries none, a rate limit), fall back to the caller's own
 * key, and never show the body. Importing nothing, so it runs under the
 * bare test runner.
 */
const BY_CODE: Record<string, string> = {
  link_not_found: 'takeLinkFailed',
  name_taken: 'takeNameTakenError',
  no_level_scale: 'takeExamNotReady',
  already_submitted: 'takeAlreadySubmitted',
  token_invalid: 'takeSessionExpired',
  time_up: 'takeTimeUp',
  exam_closed: 'takeExamClosed',
  not_submitted: 'takeSubmitFailed',
};

export function takeErrorKey<K extends string>(
  err: unknown,
  fallback: K,
): K | 'takeLinkFailed' | 'takeNameTakenError' | 'takeExamNotReady' | 'takeAlreadySubmitted'
  | 'takeSessionExpired' | 'takeTimeUp' | 'takeExamClosed' | 'takeSubmitFailed' | 'takeTooManyRequests' {
  if (!err || typeof err !== 'object') return fallback;
  const { code, status } = err as { code?: unknown; status?: unknown };
  if (typeof code === 'string' && code in BY_CODE) return BY_CODE[code] as never;
  if (status === 429) return 'takeTooManyRequests';
  return fallback;
}
