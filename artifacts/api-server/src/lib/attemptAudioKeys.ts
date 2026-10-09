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

/**
 * Each answer with a playable link to its recording, for the teacher's
 * marking screen. The recording was kept for exactly this: a read-aloud
 * mark is a transcript-accuracy score, and a teacher who doubts it (a
 * microphone that clipped, a child with an accent the transcriber missed)
 * has to be able to hear the child, or the stored voice serves nobody.
 *
 * `sign` is passed in so this stays free of the bucket client; a link that
 * cannot be signed is `null`, and the screen says so rather than failing.
 */
export async function withRecordingUrls<A extends { response: unknown }>(
  answers: readonly A[],
  sign: (key: string) => Promise<string | null>,
): Promise<Array<A & { audioUrl: string | null }>> {
  return Promise.all(
    answers.map(async a => {
      const key = attemptAudioKey(a.response);
      return { ...a, audioUrl: key ? await sign(key) : null };
    }),
  );
}
