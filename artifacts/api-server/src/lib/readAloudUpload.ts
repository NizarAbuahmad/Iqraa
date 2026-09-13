/**
 * Pure validation for the read-aloud upload route, split out of
 * `routes/studentAttempt.ts` so it is unit-testable — that file imports
 * `@workspace/db` at module scope, which throws without `DATABASE_URL`, so
 * nothing importing it is reachable from `node --test`. Same reasoning as
 * `lessonMediaUpload.ts`, which this sits beside.
 *
 * Worth splitting rather than leaving inline: these are the ceilings on the
 * only route in the API that spends money for a caller with no account. A
 * guard nothing can exercise is a guard nobody notices the loss of.
 */

/** Two minutes. Any real read-aloud passage is well under a minute spoken. */
export const MAX_AUDIO_SECONDS = 120;

/** Enough to recover from a fumble or a bad microphone; not enough to farm. */
export const MAX_TAKES_PER_QUESTION = 3;

/**
 * Audio only, and only what `speechToText` accepts directly.
 *
 * The shared `EXTENSION_BY_MIME` in `lessonMediaUpload.ts` also covers images
 * and PDFs; reusing it here would let a JPEG be posted to a transcription
 * endpoint. Narrower on purpose.
 *
 * Every value maps to a format `speechToText` takes as-is, so
 * `ensureCompatibleFormat` is never reached — it shells out to ffmpeg, which
 * is not installed in the runtime image, and would fail every browser
 * recording at the conversion step.
 */
const AUDIO_TYPES: Record<string, { extension: string; transcribeAs: "wav" | "mp3" | "webm" }> = {
  "audio/webm": { extension: ".webm", transcribeAs: "webm" },
  // MediaRecorder on Safari emits mp4/m4a. The transcription API sniffs the
  // container itself, so "webm" here is the transport hint, not a conversion.
  "audio/mp4": { extension: ".m4a", transcribeAs: "webm" },
  "audio/x-m4a": { extension: ".m4a", transcribeAs: "webm" },
  "audio/mpeg": { extension: ".mp3", transcribeAs: "mp3" },
  "audio/wav": { extension: ".wav", transcribeAs: "wav" },
};

export interface RecordingRejection {
  status: number;
  error: string;
  code: string;
}

export interface AcceptedRecording {
  mime: string;
  extension: string;
  transcribeAs: "wav" | "mp3" | "webm";
  durationMs: number;
}

/**
 * Decide whether a posted recording may be stored and transcribed.
 *
 * Takes the already-parsed mime rather than the data URL, so the expensive
 * base64 decode stays in the route and this stays pure and cheap.
 *
 * Order matters. The take limit is checked before anything about the payload:
 * a student who has used their three attempts should be told that, not sent
 * away to fix an audio format that was never the problem.
 */
export function checkRecording(input: {
  mime: string | null;
  durationMs: unknown;
  previousTakes: number;
  dataUrlLength: number;
  maxDataUrlLength: number;
}): RecordingRejection | AcceptedRecording {
  if (input.previousTakes >= MAX_TAKES_PER_QUESTION) {
    return {
      status: 429,
      error: `You can record this question ${MAX_TAKES_PER_QUESTION} times`,
      code: "too_many_takes",
    };
  }

  if (!input.mime) {
    return { status: 400, error: "audio must be a base64 data URL", code: "bad_audio" };
  }

  const type = AUDIO_TYPES[input.mime];
  if (!type) {
    return { status: 400, error: `Unsupported audio type: ${input.mime}`, code: "bad_audio_type" };
  }

  if (input.dataUrlLength > input.maxDataUrlLength) {
    return { status: 413, error: "That recording is too large", code: "audio_too_large" };
  }

  /*
   * Duration is what gets billed, and bytes are not a proxy for it: 8 MB of
   * opus is roughly ninety minutes of audio, so the size ceiling alone leaves
   * the cost ceiling wide open.
   *
   * The client reports this and is not trusted — but it is not the only guard
   * either. The take limit and the per-attempt rate limiter bound what a lying
   * client can spend, and understating the duration only understates the
   * ledger, which is a reporting problem rather than an unbounded one.
   */
  const durationMs = Number(input.durationMs);
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return { status: 400, error: "durationMs is required", code: "bad_duration" };
  }
  if (durationMs > MAX_AUDIO_SECONDS * 1000) {
    return {
      status: 413,
      error: `Recordings are limited to ${MAX_AUDIO_SECONDS} seconds`,
      code: "audio_too_long",
    };
  }

  return { mime: input.mime, extension: type.extension, transcribeAs: type.transcribeAs, durationMs };
}

export function isRejection(r: RecordingRejection | AcceptedRecording): r is RecordingRejection {
  return "status" in r;
}
