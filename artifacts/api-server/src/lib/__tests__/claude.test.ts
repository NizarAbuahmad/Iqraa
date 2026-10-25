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
} from "../claude.ts";

type Seen = { url: string; headers: IncomingMessage["headers"]; body: Record<string, any> };

let server: Server;
let client: Anthropic;
let seen: Seen[] = [];
let reply: Record<string, unknown> = {};

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
      seen.push({ url: req.url ?? "", headers: req.headers, body: JSON.parse(raw || "{}") });
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
  reply = message();
  delete process.env.AI_CLAUDE_EFFORT;
});

const call = (over: Partial<Parameters<typeof completeWithClaude>[0]> = {}) =>
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
