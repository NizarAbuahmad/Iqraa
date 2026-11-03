/**
 * What to tell a teacher when preparing worked steps failed.
 *
 * Kept out of the screen so it can be tested: the screen imports React Native. It
 * reads `status` and `code` off the error structurally (what `EvaluationError`
 * carries) rather than importing that class, which would pull in the module that
 * fetches.
 *
 * A 429 `worked_steps_in_progress` means the exam's worked steps, or its questions,
 * are already being prepared on the server: the app gives up after 45 s, a paper of
 * twenty takes longer, and the teacher tapped again. The first request will finish and
 * save its steps, so «could not prepare» would be wrong, and so is trying again: the
 * screen says it is running and reloads, which shows the steps if they have just landed.
 * The two spend-cap codes keep their own line, and anything else the generic one.
 */
export interface WorkedStepsFailure {
  /** The `i18n` key of the line to show. */
  messageKey: 'prepareStepsInProgress' | 'aiQuotaSpent' | 'prepareStepsFailed';
  /** Whether the screen's copy of the exam may be stale and should be reloaded. */
  refetch: boolean;
}

export function workedStepsFailure(err: unknown): WorkedStepsFailure {
  const code =
    typeof err === 'object' && err !== null && typeof (err as { code?: unknown }).code === 'string'
      ? (err as { code: string }).code
      : '';
  if (code === 'worked_steps_in_progress') return { messageKey: 'prepareStepsInProgress', refetch: true };
  if (code === 'user_quota_exceeded' || code === 'budget_exceeded') return { messageKey: 'aiQuotaSpent', refetch: false };
  return { messageKey: 'prepareStepsFailed', refetch: false };
}
