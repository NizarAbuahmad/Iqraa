/**
 * What a failed scan means for the teacher, in their language.
 *
 * Every failure on the scan paths carries a `status` and a machine-readable
 * `code` (`EvaluationError`), precisely so a screen never shows the server's
 * English on an Arabic screen — which is what production did on the first real
 * scan (STATUS.md, «The first real scan was refused»). Pure and duck-typed so
 * the bare `node --test` runner can load it; the screens map the key to text.
 */
export type ScanErrorKey =
  | 'scanTooLarge'
  | 'scanUnavailable'
  | 'scanBudgetSpent'
  | 'scanRateLimited'
  | 'scanNotPublished'
  | 'scanNoClass'
  | 'scanNotPaper'
  | 'scanFailed';

function parts(err: unknown): { status: number; code: string } {
  const e = err as { status?: unknown; code?: unknown } | null;
  return {
    status: typeof e?.status === 'number' ? e.status : 0,
    code: typeof e?.code === 'string' ? e.code : '',
  };
}

export function scanErrorKey(err: unknown): ScanErrorKey {
  const { status, code } = parts(err);
  if (code === 'image_too_large' || code === 'payload_too_large' || status === 413) return 'scanTooLarge';
  if (code === 'live_mode_off') return 'scanUnavailable';
  // Before the 429 test below: both of these are 429s, but they are not "wait a
  // moment" — the month's allowance is gone.
  if (code === 'user_quota_exceeded' || code === 'budget_exceeded') return 'scanBudgetSpent';
  if (code === 'rate_limited' || status === 429) return 'scanRateLimited';
  if (code === 'not_published') return 'scanNotPublished';
  if (code === 'no_class') return 'scanNoClass';
  if (code === 'not_paper_exam') return 'scanNotPaper';
  return 'scanFailed';
}

/** Failures that will fail every remaining photo the same way, so the batch stops. */
export function isBatchStopError(err: unknown): boolean {
  const { code } = parts(err);
  return code === 'live_mode_off' || code === 'budget_exceeded' || code === 'user_quota_exceeded';
}

/** "Wait and try again" rather than a failure. */
export function isRetryable(err: unknown): boolean {
  return scanErrorKey(err) === 'scanRateLimited';
}
