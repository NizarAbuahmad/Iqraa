/**
 * The ceilings on the read-aloud upload route.
 *
 * This is the only endpoint in the API that spends money for a caller with no
 * account — the identity is a shared exam link, which a student can forward to
 * anyone. Each assertion below is a bound on what a stranger holding that link
 * can cost, so "it still returns something sensible" is not the bar; the bar is
 * that the specific limit still fires.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_AUDIO_SECONDS,
  MAX_TAKES_PER_QUESTION,
  checkRecording,
  isRejection,
} from "../readAloudUpload.ts";

const ok = {
  mime: "audio/webm",
  durationMs: 20_000,
  previousTakes: 0,
  dataUrlLength: 500_000,
  maxDataUrlLength: 8_000_000,
};

/** Narrow to a rejection, failing the test rather than the type check. */
function rejected(input: Parameters<typeof checkRecording>[0]) {
  const r = checkRecording(input);
  assert.ok(isRejection(r), "expected a rejection, got an acceptance");
  return r;
}

describe("checkRecording", () => {
  it("accepts an ordinary recording", () => {
    const r = checkRecording(ok);
    assert.ok(!isRejection(r));
    assert.equal(r.extension, ".webm");
    assert.equal(r.transcribeAs, "webm");
    assert.equal(r.durationMs, 20_000);
  });

  it("stops a student after their allotted takes", () => {
    const r = rejected({ ...ok, previousTakes: MAX_TAKES_PER_QUESTION });
    assert.equal(r.status, 429);
    assert.equal(r.code, "too_many_takes");
  });

  it("allows the last permitted take", () => {
    // Off-by-one in the paranoid direction costs a student their final attempt.
    assert.ok(!isRejection(checkRecording({ ...ok, previousTakes: MAX_TAKES_PER_QUESTION - 1 })));
  });

  it("reports the take limit before complaining about the payload", () => {
    // A student out of attempts should be told that, not sent away to fix an
    // audio format that was never the problem.
    const r = rejected({ ...ok, previousTakes: 99, mime: "image/png", durationMs: "nonsense" });
    assert.equal(r.code, "too_many_takes");
  });

  it("refuses a recording longer than the ceiling", () => {
    const r = rejected({ ...ok, durationMs: MAX_AUDIO_SECONDS * 1000 + 1 });
    assert.equal(r.status, 413);
    assert.equal(r.code, "audio_too_long");
  });

  it("refuses a missing, zero, negative or non-numeric duration", () => {
    // Duration is what gets billed. Anything unusable must not default to
    // free — and a negative one must never credit the ledger.
    for (const durationMs of [undefined, null, 0, -5000, "soon", NaN, Infinity]) {
      const r = rejected({ ...ok, durationMs });
      assert.equal(r.code, "bad_duration", `durationMs=${String(durationMs)}`);
    }
  });

  it("refuses anything that is not audio", () => {
    // The shared EXTENSION_BY_MIME also covers images and PDFs; reusing it
    // would let a JPEG be posted to a transcription endpoint.
    for (const mime of ["image/png", "application/pdf", "text/plain", "image/jpeg"]) {
      const r = rejected({ ...ok, mime });
      assert.equal(r.code, "bad_audio_type", mime);
    }
  });

  it("refuses a payload that is not a data URL at all", () => {
    const r = rejected({ ...ok, mime: null });
    assert.equal(r.code, "bad_audio");
  });

  it("refuses an oversized payload", () => {
    const r = rejected({ ...ok, dataUrlLength: 8_000_001 });
    assert.equal(r.status, 413);
    assert.equal(r.code, "audio_too_large");
  });

  it("accepts what browsers actually record, on both engines", () => {
    // Chrome and Firefox emit webm/opus; Safari emits mp4/m4a. Rejecting
    // Safari would look like "the microphone is broken on iPhone".
    for (const mime of ["audio/webm", "audio/mp4", "audio/x-m4a", "audio/mpeg", "audio/wav"]) {
      const r = checkRecording({ ...ok, mime });
      assert.ok(!isRejection(r), mime);
    }
  });

  it("only ever asks for a format the transcriber takes as-is", () => {
    // Anything outside this set would fall to `ensureCompatibleFormat`, which
    // shells out to ffmpeg — absent from the runtime image, so every recording
    // would fail at conversion.
    for (const mime of ["audio/webm", "audio/mp4", "audio/x-m4a", "audio/mpeg", "audio/wav"]) {
      const r = checkRecording({ ...ok, mime });
      assert.ok(!isRejection(r));
      assert.ok(["wav", "mp3", "webm"].includes(r.transcribeAs), `${mime} -> ${r.transcribeAs}`);
    }
  });
});
