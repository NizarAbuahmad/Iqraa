/**
 * The student's call for a lesson explanation. Not unit-tested: it is a thin
 * wrapper over `apiJson`, which cannot be loaded under bare `node --test`.
 * What it decides — which cards to draw — is `lessonExplanationCards.ts`.
 *
 * Goes through `apiJson` (the signed-in session), unlike the exam link in
 * `studentExam.ts`: this is an account route, and the server requires the
 * student role.
 */
import { ApiError, apiJson } from './apiClient.ts';
import type { LessonTeachingOutput } from './ai/AIService.ts';

export type LessonExplanation = { content: LessonTeachingOutput; variantId: string };

export type ExplanationResult =
  | { status: 'ok'; explanation: LessonExplanation }
  | { status: 'unavailable' };

// Per session. The lesson page checks availability and the screen then asks
// for the same content; only a found explanation is remembered, so a lesson
// that was «قريبًا» is asked again the next time it is opened.
const cache = new Map<string, LessonExplanation>();

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
    // 404 is the server saying "nothing approved for this lesson yet", which
    // is an answer, not a failure. Anything else is a failure and rejects.
    if (e instanceof ApiError && e.status === 404) return { status: 'unavailable' };
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
