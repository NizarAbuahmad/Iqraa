/**
 * The student's call for a lesson explanation. Not unit-tested: it is a thin
 * wrapper over `apiJson`, which cannot be loaded under bare `node --test`.
 * What it decides — which cards to draw — is `lessonExplanationCards.ts`.
 *
 * Goes through `apiJson` (the signed-in session), unlike the exam link in
 * `studentExam.ts`: this is an account route, and the server requires the
 * student role.
 */
import { apiJson } from './apiClient.ts';
import { isNotAvailable } from './lessonExplanationErrors.ts';
import type { LessonTeachingOutput } from './ai/AIService.ts';

export type LessonExplanation = { content: LessonTeachingOutput; variantId: string };

export type ExplanationResult =
  | { status: 'ok'; explanation: LessonExplanation }
  | { status: 'unavailable' };

// For the lifetime of the module — until the app is reloaded or
// `clearLessonExplanationCache()` is called; sign-out does not clear it. The
// lesson page checks availability and the screen then asks for the same
// content; only a found explanation is remembered, so a lesson that was
// «قريبًا» is asked again the next time it is opened. What is cached is
// approved lesson content, the same for every student, not anything about the
// signed-in account.
const cache = new Map<string, LessonExplanation>();

/** Forget every remembered explanation. Nothing calls it yet. */
export function clearLessonExplanationCache(): void {
  cache.clear();
}

export async function getLessonExplanation(lessonId: string, lang: 'ar' | 'en'): Promise<ExplanationResult> {
  const key = `${lessonId}:${lang}`;
  const hit = cache.get(key);
  if (hit) return { status: 'ok', explanation: hit };
  try {
    const explanation = await apiJson<LessonExplanation>(
      `/student/lesson-explanation/${encodeURIComponent(lessonId)}?language=${lang === 'ar' ? 'arabic' : 'english'}`,
    );
    cache.set(key, explanation);
    return { status: 'ok', explanation };
  } catch (e) {
    // The server's `not_available` 404 means "nothing approved for this lesson
    // yet", which is an answer, not a failure. Anything else — including a 404
    // without that code, as from an API revision with no such route — is a
    // failure and rejects.
    if (isNotAvailable(e)) return { status: 'unavailable' };
    throw e;
  }
}

/** Queues a report for an admin. Does not remove the explanation for anyone. */
export async function reportLessonExplanation(variantId: string): Promise<void> {
  await apiJson<{ reported: boolean }>(
    `/student/lesson-explanation/${encodeURIComponent(variantId)}/report`,
    { method: 'POST' },
  );
}
