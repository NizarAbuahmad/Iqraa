/**
 * Reading the server's answer to «is there an explanation for this lesson?».
 * Pure and structural — it does not import `apiClient`, which cannot be loaded
 * under bare `node --test` — so it is unit-tested; `lessonExplanation.ts` is not.
 */

/**
 * True only for the server's own "nothing approved for this lesson" answer: a
 * 404 whose body carried `code: 'not_available'` (`NOT_AVAILABLE` in the API's
 * `studentLessonExplanation.ts`). A 404 without that code is something else —
 * typically an API revision that has no such route — and must reject, so the
 * student sees a retry rather than a permanent «قريبًا».
 */
export function isNotAvailable(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const { status, code } = err as { status?: unknown; code?: unknown };
  return status === 404 && code === 'not_available';
}
