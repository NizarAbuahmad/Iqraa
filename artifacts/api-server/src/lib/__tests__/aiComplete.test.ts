/**
 * One model call, whichever provider answers it.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/aiComplete.test.ts
 *
 * `completeAi` (a finished reply) and `openChatStream` (a streamed one) are the
 * only places a route may talk to a model. Each asks the provider the model id
 * names; if that provider refuses the ACCOUNT (a dead key, an empty balance) and
 * the other one is configured, the same request goes there instead — see
 * `providerFallback.ts` for which errors count. The fakes below stand in for the
 * two SDKs, so nothing is sent anywhere.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { completeAi, openChatStream, type AiMessage, type AiDeps } from "../aiComplete.ts";
import type { StreamChunk } from "../chatStream.ts";

/** The api-server `src` directory, for the tests that read source files. */
const SRC = fileURLToPath(new URL("../..", import.meta.url));

const apiError = (status: number, message = "error", extra: Record<string, unknown> = {}) =>
  Object.assign(new Error(message), { status, ...extra });

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  const restore = () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
  let out: T;
  try {
    out = fn();
  } catch (err) {
    restore();
    throw err;
  }
  if (out instanceof Promise) return out.finally(restore) as T;
  restore();
  return out;
}

const BOTH = {
  AI_MODEL: undefined,
  AI_MODEL_GENERATE: "gpt-5.4-mini",
  AI_MODEL_DOCUMENTS: "claude-sonnet-5-5",
  ANTHROPIC_API_KEY: "k",
};

const MESSAGES: AiMessage[] = [
  { role: "system", content: "SYS" },
  { role: "user", content: "USER" },
];

/** A fake OpenAI client. `plan` decides each call: an Error is thrown, anything else is returned. */
function fakeOpenai(plan: Array<unknown>) {
  const calls: Array<{ params: any; options: any }> = [];
  const client = {
    chat: {
      completions: {
        create: async (params: any, options?: any) => {
          calls.push({ params, options });
          const next = plan.shift();
          if (next instanceof Error) throw next;
          return next;
        },
      },
    },
  };
  return { client: client as unknown as NonNullable<AiDeps["openai"]>, calls };
}

const openaiReply = (text: string | null, usage: Record<string, unknown> = { prompt_tokens: 10, completion_tokens: 20 }) => ({
  choices: [{ message: { content: text } }],
  usage,
});

describe("completeAi — OpenAI answers", () => {
  it("sends the messages and the token ceiling as OpenAI names it, and hands the reply back untouched", async () => {
    const o = fakeOpenai([openaiReply('{"a":1}', { prompt_tokens: 5, completion_tokens: 6, prompt_tokens_details: { cached_tokens: 3 } })]);
    const out = await withEnv(BOTH, () =>
      completeAi({ model: "gpt-5.4-mini", messages: MESSAGES, maxTokens: 1500 }, { openai: o.client }),
    );
    assert.equal(o.calls.length, 1);
    assert.equal(o.calls[0]!.params.model, "gpt-5.4-mini");
    assert.equal(o.calls[0]!.params.max_completion_tokens, 1500);
    assert.deepEqual(o.calls[0]!.params.messages, MESSAGES);
    assert.equal(out.text, '{"a":1}');
    assert.equal(out.model, "gpt-5.4-mini");
    // The full usage object survives: the spend guard reads the cached-token detail from it.
    assert.deepEqual(out.usage, { prompt_tokens: 5, completion_tokens: 6, prompt_tokens_details: { cached_tokens: 3 } });
  });

  it("keeps a missing reply as null, so a caller's «?? '{}'» still means what it did", async () => {
    const o = fakeOpenai([openaiReply(null)]);
    const out = await withEnv(BOTH, () =>
      completeAi({ model: "gpt-5.4-mini", messages: MESSAGES, maxTokens: 100 }, { openai: o.client }),
    );
    assert.equal(out.text, null);
  });

  it("sends no options argument at all when neither a timeout nor a retry count is set", async () => {
    const o = fakeOpenai([openaiReply("x")]);
    await withEnv(BOTH, () =>
      completeAi({ model: "gpt-5.4-mini", messages: MESSAGES, maxTokens: 100 }, { openai: o.client }),
    );
    assert.equal(o.calls[0]!.options, undefined);
  });

  it("passes a timeout and a retry count through to the OpenAI client", async () => {
    const o = fakeOpenai([openaiReply("x")]);
    await withEnv(BOTH, () =>
      completeAi({ model: "gpt-5.4-mini", messages: MESSAGES, maxTokens: 100, timeoutMs: 4000, maxRetries: 0 }, { openai: o.client }),
    );
    assert.deepEqual(o.calls[0]!.options, { timeout: 4000, maxRetries: 0 });
  });
});

describe("completeAi — OpenAI refuses the account", () => {
  it("answers with Claude, converted, and says which model answered", async () => {
    const o = fakeOpenai([apiError(429, "quota", { code: "insufficient_quota" })]);
    const claudeCalls: any[] = [];
    const out = await withEnv(BOTH, () =>
      completeAi(
        { model: "gpt-5.4-mini", messages: MESSAGES, maxTokens: 1500 },
        {
          openai: o.client,
          claudeComplete: async (args) => {
            claudeCalls.push(args);
            return { text: "from claude", usage: { prompt_tokens: 7, completion_tokens: 8 } };
          },
        },
      ),
    );
    assert.equal(out.text, "from claude");
    assert.equal(out.model, "claude-sonnet-5-5");
    assert.deepEqual(out.usage, { prompt_tokens: 7, completion_tokens: 8 });
    assert.equal(claudeCalls.length, 1);
    assert.equal(claudeCalls[0].model, "claude-sonnet-5-5");
    assert.equal(claudeCalls[0].system, "SYS");
    assert.deepEqual(claudeCalls[0].messages, [{ role: "user", content: "USER" }]);
    assert.equal(claudeCalls[0].maxTokens, 1500);
  });

  it("sends a photo to Claude as an image block", async () => {
    const o = fakeOpenai([apiError(401, "bad key")]);
    const claudeCalls: any[] = [];
    await withEnv(BOTH, () =>
      completeAi(
        {
          model: "gpt-5.4-mini",
          maxTokens: 1500,
          messages: [
            { role: "system", content: "SYS" },
            {
              role: "user",
              content: [
                { type: "text", text: "read it" },
                { type: "image_url", image_url: { url: "data:image/jpeg;base64,QUJD" } },
              ],
            },
          ],
        },
        {
          openai: o.client,
          claudeComplete: async (args) => {
            claudeCalls.push(args);
            return { text: "{}", usage: { prompt_tokens: 1, completion_tokens: 1 } };
          },
        },
      ),
    );
    assert.deepEqual(claudeCalls[0].messages[0].content, [
      { type: "text", text: "read it" },
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "QUJD" } },
    ]);
  });

  it("rethrows OpenAI's error when Claude is not configured", async () => {
    const dead = apiError(429, "quota", { code: "insufficient_quota" });
    const o = fakeOpenai([dead]);
    await assert.rejects(
      withEnv({ ...BOTH, AI_MODEL_DOCUMENTS: undefined }, () =>
        completeAi({ model: "gpt-5.4-mini", messages: MESSAGES, maxTokens: 100 }, { openai: o.client }),
      ),
      (err) => err === dead,
    );
  });

  it("does not switch on a busy server or a rate limit", async () => {
    const busy = apiError(503, "busy");
    const o = fakeOpenai([busy]);
    let claudeCalled = false;
    await assert.rejects(
      withEnv(BOTH, () =>
        completeAi(
          { model: "gpt-5.4-mini", messages: MESSAGES, maxTokens: 100 },
          { openai: o.client, claudeComplete: async () => { claudeCalled = true; return { text: "", usage: { prompt_tokens: 0, completion_tokens: 0 } }; } },
        ),
      ),
      (err) => err === busy,
    );
    assert.equal(claudeCalled, false);
  });
});

describe("completeAi — Claude refuses the account", () => {
  it("answers with the OpenAI generation model and says so", async () => {
    const o = fakeOpenai([openaiReply("from openai")]);
    const out = await withEnv(BOTH, () =>
      completeAi(
        { model: "claude-sonnet-5-5", messages: MESSAGES, maxTokens: 100 },
        { openai: o.client, claudeComplete: async () => { throw apiError(401, "invalid x-api-key"); } },
      ),
    );
    assert.equal(out.text, "from openai");
    assert.equal(out.model, "gpt-5.4-mini");
    assert.equal(o.calls[0]!.params.model, "gpt-5.4-mini");
  });
});

describe("openChatStream", () => {
  async function* chunks(...texts: string[]): AsyncGenerator<StreamChunk> {
    for (const t of texts) yield { choices: [{ delta: { content: t } }] };
    yield { choices: [], usage: { prompt_tokens: 3, completion_tokens: 4 } };
  }
  const drain = async (it: AsyncIterable<StreamChunk>) => {
    const out: StreamChunk[] = [];
    for await (const c of it) out.push(c);
    return out;
  };

  it("opens an OpenAI stream asking for usage, and passes the abort signal", async () => {
    const o = fakeOpenai([chunks("a", "b")]);
    const ac = new AbortController();
    const out = await withEnv(BOTH, () =>
      openChatStream({ model: "gpt-5.4-mini", messages: MESSAGES, maxTokens: 900, signal: ac.signal }, { openai: o.client }),
    );
    assert.equal(out.model, "gpt-5.4-mini");
    assert.equal(o.calls[0]!.params.stream, true);
    assert.deepEqual(o.calls[0]!.params.stream_options, { include_usage: true });
    assert.equal(o.calls[0]!.params.max_completion_tokens, 900);
    assert.equal(o.calls[0]!.options.signal, ac.signal);
    assert.equal((await drain(out.stream)).length, 3);
  });

  it("opens a Claude stream instead when OpenAI refuses the account before sending anything", async () => {
    const o = fakeOpenai([apiError(429, "quota", { code: "insufficient_quota" })]);
    const claudeArgs: any[] = [];
    const out = await withEnv(BOTH, () =>
      openChatStream(
        { model: "gpt-5.4-mini", messages: MESSAGES, maxTokens: 900 },
        {
          openai: o.client,
          claudeStream: async (args) => {
            claudeArgs.push(args);
            return chunks("مرحبا");
          },
        },
      ),
    );
    assert.equal(out.model, "claude-sonnet-5-5");
    assert.equal(claudeArgs[0].system, "SYS");
    assert.deepEqual(claudeArgs[0].messages, [{ role: "user", content: "USER" }]);
    assert.equal(claudeArgs[0].maxTokens, 900);
    const got = await drain(out.stream);
    assert.equal(got[0]!.choices![0]!.delta!.content, "مرحبا");
  });

  it("rethrows when there is no other provider", async () => {
    const dead = apiError(401, "bad key");
    const o = fakeOpenai([dead]);
    await assert.rejects(
      withEnv({ ...BOTH, AI_MODEL_DOCUMENTS: undefined }, () =>
        openChatStream({ model: "gpt-5.4-mini", messages: MESSAGES, maxTokens: 100 }, { openai: o.client }),
      ),
      (err) => err === dead,
    );
  });
});

describe("no route talks to OpenAI on its own", () => {
  /**
   * The guard the fallback stands on. A route that calls
   * `openai.chat.completions.create` directly is a route an expired key breaks
   * again, and no test of that route would notice. Every call goes through
   * `aiComplete.ts`; this lists the ones that still do not, so the list can
   * only get shorter.
   */
  const ALLOWED = new Map<string, { calls: number; why: string }>([
    [
      "routes/generate.ts",
      {
        calls: 1,
        why:
          "completeOnce: generateContent wraps the WHOLE pooled flow in withProviderFallback, so the pool is read and " +
          "written under the model that answered; a fallback inside this call would store one model's paper under another's key",
      },
    ],
    [
      "routes/siteAsk.ts",
      { calls: 1, why: "public site assistant: a visitor watching a typing indicator cannot wait out a fallback" },
    ],
  ]);

  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name === "__tests__" || name === "node_modules") continue;
        walk(p, out);
      } else if (p.endsWith(".ts")) {
        out.push(p);
      }
    }
    return out;
  }

  it("lists every direct caller, and only the allowed ones, at the allowed count", () => {
    const found = new Map<string, number>();
    for (const file of walk(SRC)) {
      const n = (readFileSync(file, "utf8").match(/openai\.chat\.completions\.create\(/g) ?? []).length;
      if (n > 0) found.set(file.slice(SRC.length), n);
    }
    const expected = new Map([...ALLOWED].map(([f, v]) => [f, v.calls]));
    assert.deepEqual(
      Object.fromEntries([...found].sort()),
      Object.fromEntries([...expected].sort()),
      "a file calls OpenAI directly that is not allowed to (use completeAi / openChatStream from lib/aiComplete.ts), " +
        "or an allowed one now has a different number of calls",
    );
  });
});


describe("every route records spend against the model that answered", () => {
  /**
   * `completeAi` / `openChatStream` say which model answered, because after a
   * dead key that is not the one asked for. A route that keeps recording against
   * `getGenerationModel()` or `getChatModel()` prices a Claude reply at OpenAI's
   * rate: the ledger goes wrong in the direction that lets a budget be passed.
   * No route test stands in for either provider, so this reads the source.
   */
  const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");
  const secondArg = (call: string) => /recordUsage\(\s*[^,]+,\s*([^,]+),/.exec(call)?.[1]?.trim();

  const ROUTES = ["routes/chat.ts", "routes/evaluations.ts", "routes/attempts.ts", "lib/derivativeVerified.ts"];
  for (const rel of ROUTES) {
    it(`${rel}: no recordUsage call is priced at the model it asked for`, () => {
      const src = read(rel);
      const calls = src.match(/recordUsage\([\s\S]*?\)\s*;/g) ?? [];
      assert.ok(calls.length > 0, "found no recordUsage call");
      for (const call of calls) {
        const model = secondArg(call);
        assert.ok(model, `could not read the model argument of: ${call.slice(0, 80)}`);
        assert.doesNotMatch(model!, /getGenerationModel|getChatModel|askedModel/, `priced at the asked-for model: ${call.slice(0, 120)}`);
      }
    });
  }

  it("chat takes the model from what answered, for both reply shapes", () => {
    const src = read("routes/chat.ts");
    assert.match(src, /model = completion\.model;/);
    assert.match(src, /model = opened\.model;/);
  });

  it("evaluations.ts and attempts.ts take it from the completion in every scan and exam call", () => {
    const evals = read("routes/evaluations.ts");
    const attempts = read("routes/attempts.ts");
    assert.equal((evals.match(/const model = completion\.model;/g) ?? []).length, 3, "exam, scan-paper, scan-class-paper");
    assert.match(evals, /recordUsage\(completion\.usage, completion\.model, \{\s*kind: "solve"/, "worked steps");
    assert.equal((attempts.match(/const model = completion\.model;/g) ?? []).length, 1);
  });

  it("chat's estimate for a turn with no usage figures charges the ceiling the provider was really sent", () => {
    // Claude is sent at least 16000 tokens whatever chat asks for (thinking counts
    // against it), so charging CHAT_MAX_TOKENS for an abandoned turn would put up
    // to 13x too little against a student's budget while a fallback is running.
    const src = read("routes/chat.ts");
    assert.match(src, /isClaudeModel\(model\) \? claudeMaxTokens\(CHAT_MAX_TOKENS\) : CHAT_MAX_TOKENS/);
  });

  it("generate.ts: the questions route and /generate/solve record against the answering model", () => {
    const src = read("routes/generate.ts");
    assert.match(src, /recordUsage\(completion\.usage, completion\.model, \{\s*kind: "prompt-slides-questions"/);
    assert.match(src, /recordUsage\(done\.usage, answeredBy,/);
  });
});
