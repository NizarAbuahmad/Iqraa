/**
 * What to tell a teacher when generating questions into an exam failed.
 *
 * Kept out of the screen so it can be tested: the screen imports React Native.
 * It reads `status` off the error structurally (what `EvaluationError` carries)
 * rather than importing that class, which would pull in the module that fetches.
 *
 * A 409 from `POST /evaluations/:id/generate` means the exam is no longer a
 * draft: published, closed or deleted, either before the model was asked (no
 * `code`) or while it was writing (`no_longer_draft`). Nothing was written, and
 * trying again gets the same answer, so the screen says so and refreshes to show
 * the exam as it now is. Anything else keeps the generic line; in particular a
 * generator that did not answer is worth another try.
 *
 * A 429 with `generation_in_progress` means a request for this exam is still
 * running on the server (the app gives up after 45 s, the model can take longer,
 * and the teacher tapped again). It will finish and write the paper, so "could not
 * generate" would be wrong, and so is trying again: the screen says it is running
 * and reloads, which shows the paper if it has just landed.
 */
export interface GenerateFailure {
  /** The `i18n` key of the line to show. */
  messageKey: 'evaluationGenerateNoLongerDraft' | 'evaluationGenerateInProgress' | 'evaluationGenerateFailed';
  /** Whether the screen's copy of the exam is now stale and should be reloaded. */
  refetch: boolean;
}

export function generateFailure(err: unknown): GenerateFailure {
  const { status, code } =
    typeof err === 'object' && err !== null
      ? (err as { status?: unknown; code?: unknown })
      : { status: undefined, code: undefined };
  if (status === 409) return { messageKey: 'evaluationGenerateNoLongerDraft', refetch: true };
  if (status === 429 && code === 'generation_in_progress') {
    return { messageKey: 'evaluationGenerateInProgress', refetch: true };
  }
  return { messageKey: 'evaluationGenerateFailed', refetch: false };
}
