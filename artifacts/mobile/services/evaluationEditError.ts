/**
 * What to tell a teacher when changing a draft exam was refused because the exam
 * stopped being a draft.
 *
 * Kept out of the screens so it can be tested: they import React Native. It reads
 * `status` and `code` off the error structurally (what `EvaluationError` carries)
 * rather than importing that class, which would pull in the module that fetches.
 *
 * - Adding, editing or deleting a question answers 409 when the exam was published,
 *   closed or removed: `no_longer_draft` when it moved on while the request waited
 *   for the exam's lock, no `code` when it had already moved on. Nothing was
 *   written, and trying again gets the same answer, so the screen says so and
 *   reloads to show the exam as it now is.
 * - Deleting the exam answers 409 `still_published` when it was published
 *   meanwhile; the teacher's next step is to close it first.
 *
 * Every other failure keeps its existing line.
 */

function statusAndCode(err: unknown): { status: unknown; code: unknown } {
  if (typeof err !== 'object' || err === null) return { status: undefined, code: undefined };
  const e = err as { status?: unknown; code?: unknown };
  return { status: e.status, code: e.code };
}

/** A question add / edit / delete that the server refused because the exam is no longer a draft. */
export function editRefusedAsNotDraft(err: unknown): boolean {
  return statusAndCode(err).status === 409;
}

export interface ArchiveFailure {
  /** The `i18n` key of the line to show. */
  messageKey: 'archiveEvaluationStillPublished' | 'archiveEvaluationFailed';
  /** Whether the screen's copy of the exam is now stale and should be reloaded. */
  refetch: boolean;
}

export function archiveFailure(err: unknown): ArchiveFailure {
  const { status, code } = statusAndCode(err);
  if (status === 409 && code === 'still_published') {
    return { messageKey: 'archiveEvaluationStillPublished', refetch: true };
  }
  return { messageKey: 'archiveEvaluationFailed', refetch: false };
}
