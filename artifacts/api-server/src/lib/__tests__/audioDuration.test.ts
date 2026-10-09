/**
 * The recording length the read-aloud ceiling and the audio ledger now use.
 *
 * It replaced the client's `durationMs`, so the bar is not "parses a file" but
 * "cannot be talked down": every format is measured by what a decoder will
 * play, and the tests below each carry a header that lies about it.
 *
 * Checked by hand against real files on 2026-10-09: ffmpeg's libopus webm (20
 * and 60 ms frames), AAC m4a (plain and fragmented), MP3 at 44.1/22.05 kHz,
 * PCM WAV, and Chrome's own MediaRecorder webm — each within one frame of what
 * ffmpeg decodes.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { audioDurationMs } from "../audioDuration.ts";
import { MP3_FRAME_MS, OPUS_60MS, mp3, mp4Aac, wav, webmOpus } from "./audioFixtures.ts";

describe("audioDurationMs", () => {
  it("measures webm/opus by its packets, the way Chrome and Firefox record it", () => {
    assert.equal(audioDurationMs(webmOpus(250)), 5000); // 250 × 20 ms
    assert.equal(audioDurationMs(webmOpus(50, { toc: OPUS_60MS })), 3000);
  });

  it("is not fooled by block timecodes that claim no time passed", () => {
    // Ninety seconds of packets all stamped at 0 ms. A timestamp-based reading
    // would call this instant; a decoder plays every packet.
    assert.equal(audioDurationMs(webmOpus(4500, { timecodeStepMs: 0 })), 90_000);
  });

  it("refuses webm it cannot measure rather than calling it short", () => {
    assert.equal(audioDurationMs(webmOpus(100, { codec: "A_VORBIS" })), null);
    assert.equal(audioDurationMs(webmOpus(100, { laced: true })), null);
  });

  it("measures Safari's AAC by sample count, plain or fragmented", () => {
    // 1024 samples per AAC frame at 48 kHz: 469 frames ≈ 10 s.
    assert.equal(audioDurationMs(mp4Aac(469)), Math.round((469 * 1024 / 48000) * 1000));
    assert.equal(audioDurationMs(mp4Aac(469, { fragmented: true })), Math.round((469 * 1024 / 48000) * 1000));
  });

  it("ignores an mp4 timescale that lies", () => {
    const honest = audioDurationMs(mp4Aac(469));
    assert.equal(audioDurationMs(mp4Aac(469, { claimedTimescale: 48_000_000 })), honest);
  });

  it("refuses an mp4 track that is not AAC", () => {
    assert.equal(audioDurationMs(mp4Aac(469, { entry: "Opus" })), null);
  });

  it("measures PCM by its data, not by the byte rate the header claims", () => {
    assert.equal(audioDurationMs(wav(3)), 3000);
    // A byteRate field 100× too high would read three seconds as 30 ms.
    assert.equal(audioDurationMs(wav(3, { claimedByteRate: 3_200_000 })), 3000);
  });

  it("refuses a compressed WAV, where bytes are not time", () => {
    assert.equal(audioDurationMs(wav(3, { format: 0x55 })), null);
  });

  it("measures MP3 by its frames", () => {
    assert.equal(audioDurationMs(mp3(383)), Math.round(383 * MP3_FRAME_MS));
  });

  it("refuses an MP3 that is mostly something it could not read", () => {
    assert.equal(audioDurationMs(mp3(10, { junkBytes: 100_000 })), null);
  });

  it("refuses noise and empty input", () => {
    assert.equal(audioDurationMs(Buffer.alloc(0)), null);
    assert.equal(audioDurationMs(Buffer.alloc(50_000, 0x42)), null);
  });
});
