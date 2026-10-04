import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { attemptAudioKey, attemptAudioKeys, withRecordingUrls } from "../attemptAudioKeys.ts";

describe("attemptAudioKey", () => {
  it("reads a stored recording key", () => {
    assert.equal(attemptAudioKey({ audioKey: "attempt-audio/abc.webm", transcript: "x" }), "attempt-audio/abc.webm");
  });

  it("ignores the old placeholder the exam screen used to write", () => {
    assert.equal(attemptAudioKey({ audioKey: "saved", transcript: "x" }), null);
  });

  it("ignores answers that are not recordings, and keys outside the prefix", () => {
    assert.equal(attemptAudioKey({ text: "42" }), null);
    assert.equal(attemptAudioKey({ audioKey: "lesson-media/abc.png" }), null);
    assert.equal(attemptAudioKey(null), null);
    assert.equal(attemptAudioKey("attempt-audio/abc.webm"), null);
  });
});

describe("attemptAudioKeys", () => {
  it("collects each key once", () => {
    assert.deepEqual(
      attemptAudioKeys([
        { audioKey: "attempt-audio/a.webm" },
        { audioKey: "saved" },
        { optionIds: ["x"] },
        { audioKey: "attempt-audio/a.webm" },
        { audioKey: "attempt-audio/b.m4a" },
      ]),
      ["attempt-audio/a.webm", "attempt-audio/b.m4a"],
    );
  });
});

describe("withRecordingUrls", () => {
  it("signs only real recordings, and keeps every answer", async () => {
    const signed: string[] = [];
    const out = await withRecordingUrls(
      [
        { id: "a", response: { audioKey: "attempt-audio/1.webm", transcript: "t" } },
        { id: "b", response: { audioKey: "saved" } },
        { id: "c", response: { text: "42" } },
      ],
      async key => {
        signed.push(key);
        return `https://signed/${key}`;
      },
    );
    assert.deepEqual(signed, ["attempt-audio/1.webm"]);
    assert.deepEqual(out.map(a => [a.id, a.audioUrl]), [
      ["a", "https://signed/attempt-audio/1.webm"],
      ["b", null],
      ["c", null],
    ]);
  });

  it("passes an unsignable link through as null", async () => {
    const out = await withRecordingUrls([{ response: { audioKey: "attempt-audio/1.webm" } }], async () => null);
    assert.equal(out[0]!.audioUrl, null);
  });
});
