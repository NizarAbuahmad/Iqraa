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
  takesUsed,
} from "../readAloudUpload.ts";
import { webmOpus } from "./audioFixtures.ts";

const ok = {
  mime: "audio/webm",
  audio: webmOpus(1000) as Buffer | null, // 20 s of 20 ms opus packets
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
    const r = rejected({ ...ok, previousTakes: 99, mime: "image/png", audio: null });
    assert.equal(r.code, "too_many_takes");
  });

  it("refuses a recording longer than the ceiling, measured from the audio", () => {
    // 122 s of packets. There is no client duration to lie with any more —
    // the old route took `durationMs: 1000` for this and billed one second.
    const r = rejected({ ...ok, audio: webmOpus(6100) });
    assert.equal(r.status, 413);
    assert.equal(r.code, "audio_too_long");
  });

  it("allows a full-length take with the encoder's last packet just past the limit", () => {
    const r = checkRecording({ ...ok, audio: webmOpus(MAX_AUDIO_SECONDS * 50 + 3) });
    assert.ok(!isRejection(r));
  });

  it("reports the measured duration, which is what gets billed", () => {
    const r = checkRecording({ ...ok, audio: webmOpus(150) });
    assert.ok(!isRejection(r));
    assert.equal(r.durationMs, 3000);
  });

  it("refuses audio whose length cannot be read rather than treating it as short", () => {
    // Unmeasurable must not default to free.
    for (const audio of [null, Buffer.alloc(0), Buffer.alloc(4096, 0x42), webmOpus(50, { laced: true })]) {
      const r = rejected({ ...ok, audio });
      assert.equal(r.code, "bad_audio");
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

describe("takesUsed", () => {
  it("reads the claimed count off a stored answer", () => {
    assert.equal(takesUsed({ takes: 2, audioKey: "k" }), 2);
  });

  it("reads anything else as none used, never as negative", () => {
    for (const response of [undefined, null, {}, { takes: "3" }, { takes: -1 }, { takes: 1.5 }]) {
      assert.equal(takesUsed(response), 0, JSON.stringify(response));
    }
  });
});
