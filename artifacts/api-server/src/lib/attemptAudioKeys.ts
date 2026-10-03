/**
 * Which stored recordings an attempt's answers point at.
 *
 * Its own module, importing nothing, so the rule is testable without a
 * database or a bucket. The prefix check is the point: the exam screen used
 * to echo a placeholder `audioKey: 'saved'` back over the real key (fixed in
 * #776), so rows written before that fix carry a string that is not an
 * object at all, and deleting it would be a request for a key that never
 * existed — harmless, but noise in the very log line that is supposed to say
 * a child's recording was left behind.
 */
export const ATTEMPT_AUDIO_PREFIX = "attempt-audio/";

export function attemptAudioKey(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;
  const key = (response as Record<string, unknown>)["audioKey"];
  return typeof key === "string" && key.startsWith(ATTEMPT_AUDIO_PREFIX) ? key : null;
}

export function attemptAudioKeys(responses: readonly unknown[]): string[] {
  return [...new Set(responses.map(attemptAudioKey).filter((k): k is string => k !== null))];
}
