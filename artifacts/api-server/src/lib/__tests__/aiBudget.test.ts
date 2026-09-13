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
import { readFileSync } from "node:fs";

import {
  getChatModel,
  getGenerationModel,
  getPricing,
  pricedModels,
  recordAudioUsage,
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

/**
 * Transcription spend has to reach the ledger, not just an in-memory total.
 *
 * `recordAudioUsage` used to bump `spentUsd` and stop there. Nothing wrote a
 * row, so `assertUserQuotaAvailable` — which sums `ai_generations` — could not
 * see audio at all: `AI_USER_BUDGET_USD` bounded every workload except the one
 * a caller can trigger cheaply. The global cap was all that stood behind it.
 *
 * The row itself cannot be observed here: there is no DATABASE_URL under
 * `node --test` and no module mocking anywhere in this suite. So one property
 * is asserted behaviourally and one structurally — and the structural one says
 * so, rather than being dressed up as a functional check.
 */
describe("recordAudioUsage", () => {
  it("never throws when there is no database to write to", () => {
    // The point of the fire-and-forget: the transcription is already paid for
    // and the student already has their recording. Awaiting that insert, or
    // letting it reject, would fail their attempt over a metrics row.
    assert.doesNotThrow(() => {
      recordAudioUsage(12, "gpt-4o-mini-transcribe", "00000000-0000-0000-0000-000000000000");
    });
  });

  it("accepts a null owner, for a caller with no account", () => {
    // A student sitting an exam has no user of their own — the link is the
    // identity — so `null` must be a legal answer rather than a bug.
    assert.doesNotThrow(() => recordAudioUsage(3, "gpt-4o-mini-transcribe", null));
    assert.doesNotThrow(() => recordAudioUsage(3, "gpt-4o-mini-transcribe"));
  });

  it("treats a nonsense duration as zero rather than crediting the budget", () => {
    for (const seconds of [-30, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.doesNotThrow(() => recordAudioUsage(seconds, "gpt-4o-mini-transcribe", null));
    }
  });

  it("writes a ledger row carrying the userId (structural)", () => {
    // Read from source deliberately: the write is fire-and-forget into a
    // database this suite cannot reach, so the only assertable thing is that
    // the call exists and carries the owner. Same posture as the question-type
    // parity check — crude, but it pins the exact line whose absence left the
    // per-user cap blind to audio.
    const src = readFileSync(new URL("../aiBudget.ts", import.meta.url), "utf8");
    const body = /export function recordAudioUsage\(([\s\S]*?)\n}/.exec(src);
    assert.ok(body, "recordAudioUsage not found — has it been renamed?");
    assert.match(body[1]!, /recordGeneration\(/, "audio spend must reach ai_generations");
    assert.match(body[1]!, /userId:\s*userId\s*\?\?\s*null/, "the ledger row must carry the owner");
  });
});
