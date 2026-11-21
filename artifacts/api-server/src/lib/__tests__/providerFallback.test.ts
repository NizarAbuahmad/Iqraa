/**
 * When one AI provider refuses the ACCOUNT, answer with the other.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/providerFallback.test.ts
 *
 * Why it exists: production writes lesson plans, worksheets, quizzes, slide
 * decks and lesson explanations with Claude (`AI_MODEL_DOCUMENTS`), and every
 * other generator with OpenAI. `usableModel` only skips Claude when the key is
 * UNSET — an expired key, a revoked one or an empty credit balance was used
 * anyway, and every one of those requests failed until someone rotated the
 * secret. These pin which errors switch provider (account problems only — not
 * a busy server, not a refusal, not a malformed reply) and to which model.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  fallbackModelFor,
  isProviderAccountError,
  withProviderFallback,
} from "../providerFallback.ts";

/** An error shaped like both SDKs' `APIError`: a numeric `status`, sometimes a `code`. */
function apiError(status: number, message = "error", extra: Record<string, unknown> = {}): Error {
  return Object.assign(new Error(message), { status, ...extra });
}

/**
 * Set env for the duration of `fn`, including an async `fn`: the env is put back
 * only once a returned promise settles, because the fallback reads it AFTER the
 * first attempt has failed.
 */
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

describe("isProviderAccountError", () => {
  it("switches on a bad, expired or unpermitted key", () => {
    assert.equal(isProviderAccountError(apiError(401, "invalid x-api-key")), true);
    assert.equal(isProviderAccountError(apiError(403, "permission_error")), true);
  });

  it("switches on an empty balance, as each provider reports it", () => {
    // Anthropic: 402 billing_error, or the older 400 "credit balance is too low".
    assert.equal(isProviderAccountError(apiError(402, "billing_error")), true);
    assert.equal(
      isProviderAccountError(apiError(400, "Your credit balance is too low to access the Anthropic API.")),
      true,
    );
    // OpenAI: a 429 that is not a rate limit at all.
    assert.equal(isProviderAccountError(apiError(429, "quota", { code: "insufficient_quota" })), true);
    assert.equal(
      isProviderAccountError(apiError(429, "quota", { error: { code: "insufficient_quota" } })),
      true,
    );
  });

  it("switches on a model the account cannot use", () => {
    assert.equal(isProviderAccountError(apiError(404, "model: claude-sonnet-5-5")), true);
  });

  it("switches when the Claude key is not configured at all", () => {
    const err = new Error("ANTHROPIC_API_KEY is not set");
    err.name = "ClaudeNotConfiguredError";
    assert.equal(isProviderAccountError(err), true);
  });

  it("does NOT switch on a busy server, a rate limit, a refusal or a bad request", () => {
    // These pass on their own or are the request's fault; the other provider
    // would not fix them, and a doubled call on every 429 doubles the spend.
    assert.equal(isProviderAccountError(apiError(429, "rate limit")), false);
    assert.equal(isProviderAccountError(apiError(500, "server")), false);
    assert.equal(isProviderAccountError(apiError(529, "overloaded")), false);
    assert.equal(isProviderAccountError(apiError(400, "max_tokens is too large")), false);
    const refusal = new Error("Claude declined");
    refusal.name = "ClaudeRefusalError";
    assert.equal(isProviderAccountError(refusal), false);
    assert.equal(isProviderAccountError(new Error("Unexpected token in JSON")), false);
    assert.equal(isProviderAccountError(undefined), false);
    assert.equal(isProviderAccountError("401"), false);
  });
});

describe("fallbackModelFor", () => {
  it("backs Claude with the OpenAI generation model", () => {
    withEnv(BOTH, () => {
      assert.equal(fallbackModelFor("claude-sonnet-5-5"), "gpt-5.4-mini");
    });
  });

  it("backs OpenAI with the Claude documents model when Claude is set up", () => {
    withEnv(BOTH, () => {
      assert.equal(fallbackModelFor("gpt-5.4-mini"), "claude-sonnet-5-5");
    });
  });

  it("has no backup for OpenAI when Claude is not configured", () => {
    withEnv({ ...BOTH, AI_MODEL_DOCUMENTS: undefined }, () => {
      assert.equal(fallbackModelFor("gpt-5.4-mini"), null);
    });
    withEnv({ ...BOTH, ANTHROPIC_API_KEY: undefined }, () => {
      assert.equal(fallbackModelFor("gpt-5.4-mini"), null);
    });
    // AI_MODEL_DOCUMENTS pointed at another OpenAI model is not a second provider.
    withEnv({ ...BOTH, AI_MODEL_DOCUMENTS: "gpt-5.4" }, () => {
      assert.equal(fallbackModelFor("gpt-5.4-mini"), null);
    });
  });
});

describe("withProviderFallback", () => {
  it("answers with the other provider when the first refuses the account", async () => {
    const tried: string[] = [];
    const out = await withEnv(BOTH, () =>
      withProviderFallback("claude-sonnet-5-5", async (model) => {
        tried.push(model);
        if (model === "claude-sonnet-5-5") throw apiError(401, "invalid x-api-key");
        return `made by ${model}`;
      }),
    );
    assert.deepEqual(tried, ["claude-sonnet-5-5", "gpt-5.4-mini"]);
    assert.equal(out, "made by gpt-5.4-mini");
  });

  it("calls the first provider only once when it works", async () => {
    const tried: string[] = [];
    await withEnv(BOTH, () =>
      withProviderFallback("claude-sonnet-5-5", async (model) => {
        tried.push(model);
        return "ok";
      }),
    );
    assert.deepEqual(tried, ["claude-sonnet-5-5"]);
  });

  it("rethrows the original error when the failure is not an account problem", async () => {
    const busy = apiError(529, "overloaded");
    const tried: string[] = [];
    await assert.rejects(
      withEnv(BOTH, () =>
        withProviderFallback("claude-sonnet-5-5", async (model) => {
          tried.push(model);
          throw busy;
        }),
      ),
      (err) => err === busy,
    );
    assert.deepEqual(tried, ["claude-sonnet-5-5"]);
  });

  it("rethrows the original error when there is no other provider", async () => {
    const dead = apiError(429, "quota", { code: "insufficient_quota" });
    await assert.rejects(
      withEnv({ ...BOTH, AI_MODEL_DOCUMENTS: undefined }, () =>
        withProviderFallback("gpt-5.4-mini", async () => {
          throw dead;
        }),
      ),
      (err) => err === dead,
    );
  });

  it("switches once, never back: both providers down surfaces the second error", async () => {
    const tried: string[] = [];
    const second = apiError(429, "quota", { code: "insufficient_quota" });
    await assert.rejects(
      withEnv(BOTH, () =>
        withProviderFallback("claude-sonnet-5-5", async (model) => {
          tried.push(model);
          throw model.startsWith("claude-") ? apiError(402, "billing_error") : second;
        }),
      ),
      (err) => err === second,
    );
    assert.deepEqual(tried, ["claude-sonnet-5-5", "gpt-5.4-mini"]);
  });
});

describe("the generate route", () => {
  it("sends every pooled generation through withProviderFallback", () => {
    // generateContent is the one door for lesson plans, worksheets, quizzes,
    // slides, lesson explanations, homework and activities. If it calls the
    // pooled flow directly again, an expired key fails them all with nothing
    // in this file's own tests noticing.
    const src = readFileSync(new URL("../../routes/generate.ts", import.meta.url), "utf8");
    const start = src.indexOf("async function generateContent(");
    const end = src.indexOf("async function generateContentWith(");
    assert.ok(start >= 0 && end > start, "generateContent and generateContentWith both exist, in that order");
    const body = src.slice(start, end);
    assert.match(body, /withProviderFallback\(/);
    assert.match(body, /generateContentWith\(/);
  });
});
