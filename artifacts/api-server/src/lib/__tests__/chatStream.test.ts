/**
 * The pure half of /chat's streaming path: frame encoding, content
 * negotiation, the spend estimate used when a client disconnects before the
 * usage chunk, and the pump that turns OpenAI chunks into frames.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/chatStream.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  estimateTokens,
  pumpChatStream,
  sseFrame,
  wantsEventStream,
  type StreamChunk,
} from "../chatStream.ts";

async function* chunks(items: StreamChunk[]): AsyncIterable<StreamChunk> {
  for (const item of items) yield item;
}

function sink() {
  const frames: string[] = [];
  return { frames, write: (f: string) => { frames.push(f); } };
}

describe("sseFrame", () => {
  it("encodes one event as a data line followed by a blank line", () => {
    assert.equal(sseFrame({ type: "delta", text: "مرحبًا" }), 'data: {"type":"delta","text":"مرحبًا"}\n\n');
  });
  it("keeps newlines inside the JSON string, never as raw line breaks", () => {
    const frame = sseFrame({ type: "delta", text: "a\nb" });
    assert.equal(frame.split("\n").length, 3, "one data line + two terminators");
    assert.ok(frame.includes("\\n"));
  });
});

describe("wantsEventStream", () => {
  it("is true for text/event-stream, whatever else Accept lists", () => {
    assert.equal(wantsEventStream("text/event-stream"), true);
    assert.equal(wantsEventStream("application/json, text/event-stream;q=0.9"), true);
    assert.equal(wantsEventStream("TEXT/EVENT-STREAM"), true);
  });
  it("is false for a missing or JSON-only Accept header", () => {
    assert.equal(wantsEventStream(undefined), false);
    assert.equal(wantsEventStream("application/json"), false);
    assert.equal(wantsEventStream("*/*"), false);
  });
});

describe("estimateTokens", () => {
  it("errs high: three characters per token, rounded up", () => {
    assert.equal(estimateTokens(""), 0);
    assert.equal(estimateTokens("ab"), 1);
    assert.equal(estimateTokens("abcd"), 2);
    assert.equal(estimateTokens("الاقتران العكسي"), 5);
  });
  it("takes a character count for a prompt made of several strings", () => {
    assert.equal(estimateTokens(0), 0);
    assert.equal(estimateTokens(7), 3);
  });
});

describe("pumpChatStream", () => {
  it("writes one delta frame per content chunk, then a done frame with the whole text", async () => {
    const s = sink();
    const result = await pumpChatStream(
      chunks([
        { choices: [{ delta: { content: "الاقتران " } }] },
        { choices: [{ delta: { content: "العكسي" } }] },
        { choices: [], usage: { prompt_tokens: 40, completion_tokens: 6 } },
      ]),
      s,
      new AbortController().signal,
    );
    assert.deepEqual(result, {
      content: "الاقتران العكسي",
      usage: { prompt_tokens: 40, completion_tokens: 6 },
      aborted: false,
    });
    assert.deepEqual(s.frames, [
      sseFrame({ type: "delta", text: "الاقتران " }),
      sseFrame({ type: "delta", text: "العكسي" }),
      sseFrame({ type: "done", content: "الاقتران العكسي" }),
    ]);
  });

  it("skips chunks with empty or null content and chunks with no choices", async () => {
    const s = sink();
    const result = await pumpChatStream(
      chunks([
        { choices: [{ delta: { content: null } }] },
        { choices: [{ delta: { content: "" } }] },
        { choices: [{ delta: {} }] },
        { choices: [{ delta: { content: "x" } }] },
      ]),
      s,
      new AbortController().signal,
    );
    assert.equal(result.content, "x");
    assert.equal(result.usage, null);
    assert.equal(s.frames.length, 2, "one delta + done");
  });

  it("stops writing once the signal is aborted and reports what arrived", async () => {
    const s = sink();
    const controller = new AbortController();
    async function* aborting(): AsyncIterable<StreamChunk> {
      yield { choices: [{ delta: { content: "أ" } }] };
      controller.abort();
      yield { choices: [{ delta: { content: "ب" } }] };
      yield { choices: [], usage: { prompt_tokens: 1, completion_tokens: 2 } };
    }
    const result = await pumpChatStream(aborting(), s, controller.signal);
    assert.deepEqual(result, { content: "أ", usage: null, aborted: true });
    assert.deepEqual(s.frames, [sseFrame({ type: "delta", text: "أ" })], "no done frame after abort");
  });

  it("treats an AbortError thrown by the iterator as an abort, not a failure", async () => {
    const s = sink();
    const controller = new AbortController();
    async function* throwing(): AsyncIterable<StreamChunk> {
      yield { choices: [{ delta: { content: "أ" } }] };
      controller.abort();
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    }
    const result = await pumpChatStream(throwing(), s, controller.signal);
    assert.deepEqual(result, { content: "أ", usage: null, aborted: true });
  });

  it("rethrows any other iterator error", async () => {
    async function* failing(): AsyncIterable<StreamChunk> {
      yield { choices: [{ delta: { content: "أ" } }] };
      throw new Error("upstream 500");
    }
    await assert.rejects(
      () => pumpChatStream(failing(), sink(), new AbortController().signal),
      /upstream 500/,
    );
  });
});
