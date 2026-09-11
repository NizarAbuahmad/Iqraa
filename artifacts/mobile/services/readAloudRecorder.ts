/**
 * Browser-side plumbing for a read-aloud recording.
 *
 * Its own module, importing nothing from the app, for the reason
 * `routeGating.ts` gives: `node --test` cannot resolve the extensionless
 * relative imports the rest of the app relies on esbuild for.
 *
 * Web only. `MediaRecorder`, `navigator.mediaDevices` and `FileReader` do not
 * exist under React Native, and this app deliberately has no microphone
 * permission on either native platform — `app.json` sets
 * `microphonePermission: false`. Callers gate on `Platform.OS === 'web'` and
 * show a "open this on the web" fallback otherwise, the same way the classroom
 * presentation screen handles its iframes.
 */

/**
 * Hard stop for a recording, matching `MAX_AUDIO_SECONDS` on the server.
 *
 * Client-side it is a courtesy — the student gets stopped rather than
 * rejected after the upload — but the server's copy is the one that counts.
 * Duplicated as a number rather than shared because the client cannot import
 * from api-server, and a comment naming the counterpart is more honest than a
 * package boundary crossed for one integer.
 */
export const MAX_RECORD_MS = 120_000;

/** Whether this browser can record at all. */
export function isRecordingSupported(): boolean {
  return (
    typeof navigator !== 'undefined'
    && typeof navigator.mediaDevices?.getUserMedia === 'function'
    && typeof MediaRecorder !== 'undefined'
  );
}

/**
 * Read a recorded blob as a `data:` URL for the upload body.
 *
 * The upload route takes a base64 data URL rather than multipart, because that
 * is what every other media upload in this API already takes
 * (`lessonMediaUpload.ts`), and one shape is worth more than the ~33% the
 * encoding costs on a file this small.
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the recording'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') resolve(result);
      else reject(new Error('Could not read the recording'));
    };
    reader.readAsDataURL(blob);
  });
}

/** `95` -> `1:35`. Whole seconds; a recording timer with decimals reads as a stopwatch. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
