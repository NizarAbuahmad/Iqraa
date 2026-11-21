/**
 * The Claude completion helper, against a real SDK client and a local server.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/claude.test.ts
 *
 * No key and no network: the SDK talks to a throwaway HTTP server on 127.0.0.1,
 * so what is asserted is the request that would actually be sent (path, headers,
 * serialised body) and how a reply is read, not a hand-made mock of the SDK.
 */
import { afterEach, before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import Anthropic from "@anthropic-ai/sdk";

import {
  CLAUDE_MIN_MAX_TOKENS,
  ClaudeNotConfiguredError,
  ClaudeRefusalError,
  completeWithClaude,
  streamWithClaude,
} from "../claude.ts";

type Seen = { url: string; headers: IncomingMessage["headers"]; body: Record<string, any> };

let server: Server;
let client: Anthropic;
let seen: Seen[] = [];
let reply: Record<string, unknown> = {};
/** Server-sent events for a `stream: true` request, as [event name, payload] pairs. */
let streamEvents: Array<[string, Record<string, unknown>]> = [];

const message = (over: Record<string, unknown> = {}) => ({
  id: "msg_test",
  type: "message",
  role: "assistant",
  model: "claude-sonnet-5-5",
  content: [{ type: "text", text: '{"title":"x"}' }],
  stop_reason: "end_turn",
  stop_sequence: null,
  usage: { input_tokens: 123, output_tokens: 456 },
  ...over,
});

before(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = JSON.parse(raw || "{}");
      seen.push({ url: req.url ?? "", headers: req.headers, body });
      if (body.stream) {
        res.writeHead(200, { "content-type": "text/event-stream" });
        for (const [event, data] of streamEvents) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        res.end();
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(reply));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  client = new Anthropic({ apiKey: "test-key", baseURL: `http://127.0.0.1:${port}`, maxRetries: 0 });
});

after(() => new Promise<void>((r) => server.close(() => r())));

afterEach(() => {
  seen = [];
  streamEvents = [];
  reply = message();
  delete process.env.AI_CLAUDE_EFFORT;
});

const call = (over: Partial<{ model: string; system: string; user: string; maxTokens: number }> = {}) =>
  completeWithClaude(
    { model: "claude-sonnet-5-5", system: "SYS", user: "USER", maxTokens: 8000, ...over },
    { client },
  );

describe("completeWithClaude — the request", () => {
  it("sends what the evaluation measured: adaptive thinking at medium effort, system and user mapped", async () => {
    reply = message();
    await call();
    assert.equal(seen.length, 1);
    const { url, headers, body } = seen[0]!;
    assert.equal(url, "/v1/messages");
    assert.equal(headers["x-api-key"], "test-key");
    assert.equal(body.model, "claude-sonnet-5-5");
    assert.equal(body.system, "SYS");
    assert.deepEqual(body.messages, [{ role: "user", content: "USER" }]);
    assert.deepEqual(body.thinking, { type: "adaptive" });
    assert.deepEqual(body.output_config, { effort: "medium" });
  });

  it("never asks for fewer than the tokens thinking needs, and never cuts a caller that asks for more", async () => {
    // Thinking tokens count against max_tokens. The shared 8000 would cut a deck
    // off mid-answer; the evaluation ran every document at 16000.
    await call({ maxTokens: 8000 });
    await call({ maxTokens: 20000 });
    assert.equal(seen[0]!.body.max_tokens, CLAUDE_MIN_MAX_TOKENS);
    assert.equal(seen[1]!.body.max_tokens, 20000);
  });

  it("takes the effort from AI_CLAUDE_EFFORT, and ignores a value that is not an effort", async () => {
    process.env.AI_CLAUDE_EFFORT = "high";
    await call();
    process.env.AI_CLAUDE_EFFORT = "turbo";
    await call();
    assert.deepEqual(seen[0]!.body.output_config, { effort: "high" });
    assert.deepEqual(seen[1]!.body.output_config, { effort: "medium" });
  });
});

describe("completeWithClaude — the reply", () => {
  it("returns only the text blocks, joined, and leaves the thinking out", async () => {
    reply = message({
      content: [
        { type: "thinking", thinking: "working it out", signature: "sig" },
        { type: "text", text: '{"title":' },
        { type: "text", text: '"x"}' },
      ],
    });
    const out = await call();
    assert.equal(out.text, '{"title":"x"}');
    assert.ok(!out.text.includes("working it out"));
  });

  it("renames the usage to the pair the spend guard takes", async () => {
    reply = message({ usage: { input_tokens: 1000, output_tokens: 2500 } });
    const out = await call();
    assert.deepEqual(out.usage, { prompt_tokens: 1000, completion_tokens: 2500 });
  });

  it("throws on a refusal instead of returning an empty answer, naming the category", async () => {
    reply = message({
      content: [],
      stop_reason: "refusal",
      stop_details: { type: "refusal", category: "bio", explanation: null },
    });
    await assert.rejects(call(), (err: unknown) => {
      assert.ok(err instanceof ClaudeRefusalError);
      assert.equal((err as ClaudeRefusalError).category, "bio");
      return true;
    });
  });
});

describe("completeWithClaude — no key", () => {
  it("throws ClaudeNotConfiguredError rather than building a client, and importing never needed one", async () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      await assert.rejects(
        completeWithClaude({ model: "claude-sonnet-5-5", system: "S", user: "U", maxTokens: 8000 }),
        ClaudeNotConfiguredError,
      );
    } finally {
      if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
    }
  });
});


describe("completeWithClaude — a whole message list", () => {
  it("sends the list as given, with a photo as an image block, instead of one user prompt", async () => {
    await completeWithClaude(
      {
        model: "claude-sonnet-5-5",
        system: "SYS",
        maxTokens: 1500,
        messages: [
          { role: "user", content: "q1" },
          { role: "assistant", content: "a1" },
          {
            role: "user",
            content: [
              { type: "text", text: "read it" },
              { type: "image", source: { type: "base64", media_type: "image/png", data: "QUJD" } },
            ],
          },
        ],
      },
      { client },
    );
    assert.deepEqual(seen[0]!.body.messages, [
      { role: "user", content: "q1" },
      { role: "assistant", content: "a1" },
      {
        role: "user",
        content: [
          { type: "text", text: "read it" },
          { type: "image", source: { type: "base64", media_type: "image/png", data: "QUJD" } },
        ],
      },
    ]);
  });
});

const sse = {
  start: (input = 42, output = 1): [string, Record<string, unknown>] => [
    "message_start",
    { type: "message_start", message: message({ content: [], usage: { input_tokens: input, output_tokens: output } }) },
  ],
  text: (text: string, index = 0): [string, Record<string, unknown>] => [
    "content_block_delta",
    { type: "content_block_delta", index, delta: { type: "text_delta", text } },
  ],
  thinking: (thinking: string): [string, Record<string, unknown>] => [
    "content_block_delta",
    { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking } },
  ],
  end: (output: number, stop_reason = "end_turn", extra: Record<string, unknown> = {}): Array<[string, Record<string, unknown>]> => [
    ["message_delta", { type: "message_delta", delta: { stop_reason, stop_sequence: null, ...extra }, usage: { output_tokens: output } }],
    ["message_stop", { type: "message_stop" }],
  ],
};

async function collect(it: AsyncIterable<any>) {
  const out: any[] = [];
  for await (const c of it) out.push(c);
  return out;
}

describe("streamWithClaude", () => {
  it("asks for a stream with the same thinking and effort as a finished reply", async () => {
    streamEvents = [sse.start(), sse.text("hi"), ...sse.end(5)];
    await collect(await streamWithClaude({ model: "claude-sonnet-5-5", system: "SYS", maxTokens: 900, messages: [{ role: "user", content: "q" }] }, { client }));
    const body = seen[0]!.body;
    assert.equal(body.stream, true);
    assert.equal(body.system, "SYS");
    assert.deepEqual(body.thinking, { type: "adaptive" });
    assert.deepEqual(body.output_config, { effort: "medium" });
    assert.equal(body.max_tokens, CLAUDE_MIN_MAX_TOKENS);
  });

  it("forwards each text delta in the chunk shape the chat pump reads, then the usage", async () => {
    streamEvents = [sse.start(100, 1), sse.text("مر"), sse.text("حبا"), ...sse.end(7)];
    const chunks = await collect(
      await streamWithClaude({ model: "claude-sonnet-5-5", system: "S", maxTokens: 900, messages: [{ role: "user", content: "q" }] }, { client }),
    );
    assert.deepEqual(
      chunks.map((c) => c.choices?.[0]?.delta?.content).filter(Boolean),
      ["مر", "حبا"],
    );
    assert.deepEqual(chunks.at(-1), { choices: [], usage: { prompt_tokens: 100, completion_tokens: 7 } });
  });

  it("never forwards the model's thinking", async () => {
    streamEvents = [sse.start(), sse.thinking("secret working"), sse.text("answer"), ...sse.end(3)];
    const chunks = await collect(
      await streamWithClaude({ model: "claude-sonnet-5-5", system: "S", maxTokens: 900, messages: [{ role: "user", content: "q" }] }, { client }),
    );
    assert.ok(!JSON.stringify(chunks).includes("secret working"));
    assert.equal(chunks[0].choices[0].delta.content, "answer");
  });

  it("fails the stream on a refusal rather than ending it as if the answer were finished", async () => {
    streamEvents = [sse.start(), sse.text("partial"), ...sse.end(3, "refusal", { stop_details: { type: "refusal", category: "bio", explanation: null } })];
    await assert.rejects(
      collect(await streamWithClaude({ model: "claude-sonnet-5-5", system: "S", maxTokens: 900, messages: [{ role: "user", content: "q" }] }, { client })),
      (err: unknown) => err instanceof ClaudeRefusalError && err.category === "bio",
    );
  });

  it("throws from the open call, before any chunk, when the key is not accepted", async () => {
    // The point of settling at accept time: the chat route can still switch
    // provider because nothing has gone to its own client yet.
    const bad = createServer((_req, res) => {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }));
    });
    await new Promise<void>((r) => bad.listen(0, "127.0.0.1", r));
    const badClient = new Anthropic({ apiKey: "nope", baseURL: `http://127.0.0.1:${(bad.address() as AddressInfo).port}`, maxRetries: 0 });
    try {
      await assert.rejects(
        streamWithClaude({ model: "claude-sonnet-5-5", system: "S", maxTokens: 900, messages: [{ role: "user", content: "q" }] }, { client: badClient }),
        (err: any) => err.status === 401,
      );
    } finally {
      await new Promise<void>((r) => bad.close(() => r()));
    }
  });
});
