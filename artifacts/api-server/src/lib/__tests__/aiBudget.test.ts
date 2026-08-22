/**
 * The spend guard's pricing table.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/aiBudget.test.ts
 *
 * This is a safety net for testing against a real key, so the only property
 * that matters is that it can never UNDER-estimate. It could: the fallback
 * for an unrecognised model was $5/$15, under Claude Opus 5's real $5/$25,
 * so pointing AI_MODEL at a Claude model would have let a run spend well past
 * its cap while the log reported it was under.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  getChatModel,
  getGenerationModel,
  getPricing,
  pricedModels,
} from "../aiBudget.ts";

describe("getPricing", () => {
  it("never falls back to a rate cheaper than a model it knows", () => {
    // The invariant that broke. A "conservative" default that undercuts a
    // model you might actually select is not conservative.
    const fallback = getPricing("some-model-nobody-has-heard-of");
    for (const model of pricedModels()) {
      const known = getPricing(model);
      assert.ok(
        fallback.input >= known.input && fallback.output >= known.output,
        `fallback ${fallback.input}/${fallback.output} is under ${model} at ${known.input}/${known.output}`,
      );
    }
  });

  it("prices the models the product can actually be pointed at", () => {
    for (const model of ["gpt-4o-mini", "claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5"]) {
      assert.ok(pricedModels().includes(model), `${model} is unpriced`);
    }
  });

  it("prices Sonnet 5 at its standard rate, not the introductory one", () => {
    // The $2/$10 intro rate ends 2026-08-31. A guard that assumes a
    // promotional price stops guarding when the promotion does.
    assert.deepEqual(getPricing("claude-sonnet-5"), { input: 3, output: 15 });
  });

  it("charges output above input for every model, as every provider does", () => {
    for (const model of pricedModels()) {
      const { input, output } = getPricing(model);
      assert.ok(output > input, `${model} prices output at or below input`);
    }
  });
});

describe("generation vs chat model", () => {
  // One AI_MODEL drove both. A lesson plan is a single long structured
  // document where quality is worth paying for; chat is many short turns where
  // latency and cost dominate. Every choice was a compromise between two
  // workloads that share nothing but a client.
  const KEYS = ["AI_MODEL", "AI_MODEL_GENERATE", "AI_MODEL_CHAT"] as const;
  const withEnv = (env: Partial<Record<(typeof KEYS)[number], string>>, fn: () => void) => {
    const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
    try {
      for (const k of KEYS) delete process.env[k];
      for (const [k, v] of Object.entries(env)) process.env[k] = v;
      fn();
    } finally {
      for (const k of KEYS) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k]!;
      }
    }
  };

  it("both fall back to the same cheap default when nothing is set", () => {
    withEnv({}, () => {
      assert.equal(getGenerationModel(), "gpt-4o-mini");
      assert.equal(getChatModel(), "gpt-4o-mini");
    });
  });

  it("AI_MODEL alone still sets both — no existing deployment has to change", () => {
    withEnv({ AI_MODEL: "gpt-5.4-mini" }, () => {
      assert.equal(getGenerationModel(), "gpt-5.4-mini");
      assert.equal(getChatModel(), "gpt-5.4-mini");
    });
  });

  it("the specific vars override AI_MODEL per workload", () => {
    withEnv(
      { AI_MODEL: "gpt-4o-mini", AI_MODEL_GENERATE: "gpt-5.4-mini", AI_MODEL_CHAT: "gpt-5.4-nano" },
      () => {
        assert.equal(getGenerationModel(), "gpt-5.4-mini");
        assert.equal(getChatModel(), "gpt-5.4-nano");
      },
    );
  });

  it("one may be overridden without the other", () => {
    withEnv({ AI_MODEL: "gpt-4o-mini", AI_MODEL_CHAT: "gpt-5.4-nano" }, () => {
      assert.equal(getGenerationModel(), "gpt-4o-mini");
      assert.equal(getChatModel(), "gpt-5.4-nano");
    });
  });
});
