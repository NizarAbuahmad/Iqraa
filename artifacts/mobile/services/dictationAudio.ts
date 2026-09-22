/**
 * Playing a dictation prompt in the browser.
 *
 * Its own module, importing nothing from the app, for the reason
 * `readAloudRecorder.ts` and `routeGating.ts` both give: `node --test` cannot
 * resolve the extensionless relative imports the rest of the app leans on
 * esbuild for, so anything worth testing has to sit clear of them.
 *
 * **Web only, and unlike the recorder that is not a permissions decision — the
 * capability is simply absent.** React Native has no `Audio` global and this
 * app has no `expo-av` / `expo-audio` / `expo-video` dependency. Adding one is
 * a native module, which means an `app.json` version bump and a store release:
 * an OTA update shipping JS that calls into a module the installed binary
 * lacks crashes on launch and needs a reinstall to recover.
 *
 * That is survivable because audio was never the only way to sit a dictation.
 * A question with no `audioUrl` means the teacher reads it aloud — the normal
 * case today — so native students answer the same question, listening to a
 * person instead of a phone. `isPlaybackSupported()` is what the input uses to
 * decide which of those it is looking at.
 */

/** True when this runtime can play an audio URL at all. */
export function isPlaybackSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.Audio === 'function';
}

/**
 * Play a prompt once, resolving when it finishes or fails.
 *
 * Deliberately not a `<audio controls>` element. A browser's own control bar
 * carries a scrub handle, and a child who can drag the playhead past the word
 * is not taking a dictation — they are looking at a waveform. One button, one
 * play, and the caller counts them.
 *
 * Resolves rather than rejects on failure: a prompt that will not load is a
 * question the student answers by asking the teacher to read it, which is the
 * same place they would have been with no audio at all. Throwing would put an
 * error banner over a question that is still perfectly answerable.
 */
export function playPrompt(url: string): Promise<void> {
  if (!isPlaybackSupported()) return Promise.resolve();
  return new Promise<void>(resolve => {
    try {
      const audio = new window.Audio(url);
      const done = () => resolve();
      audio.addEventListener('ended', done, { once: true });
      audio.addEventListener('error', done, { once: true });
      void audio.play().catch(done);
    } catch {
      resolve();
    }
  });
}

/**
 * How many plays are left, given what the question allows and what is stored.
 *
 * The count rides in the student's own response so it survives a reload — the
 * same reason `takes` does for read-aloud. It is a **nudge, not a control**:
 * the audio URL is anonymous-read by design, so anyone determined to replay it
 * can. Enforcing it server-side would be theatre, and a limit that pretends to
 * be a lock is worse than one that admits what it is.
 */
export const DEFAULT_PLAY_LIMIT = 3;

export function playsLeft(playLimit: unknown, played: unknown): number {
  const limit =
    typeof playLimit === 'number' && Number.isInteger(playLimit) && playLimit > 0
      ? playLimit
      : DEFAULT_PLAY_LIMIT;
  const used = typeof played === 'number' && played > 0 ? played : 0;
  return Math.max(0, limit - used);
}
