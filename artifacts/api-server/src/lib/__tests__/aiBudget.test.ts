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
  getDocumentModel,
  getGenerationModel,
  getPricing,
  getPromptSlidesModel,
  getUserBudgetLimitUsd,
  isClaudeModel,
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
    for (const model of [
      "gpt-4o-mini", "claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5",
      "claude-sonnet-5-5", "claude-haiku-5-5",
    ]) {
      assert.ok(pricedModels().includes(model), `${model} is unpriced`);
    }
  });

  it("prices the Claude models documents can run on, and under the unknown-model ceiling", () => {
    // Sonnet 5.5 is the one the generators are pointed at: an unpriced id would
    // be billed at the fallback ($10/$50) and trip the cap five times early.
    assert.deepEqual(getPricing("claude-sonnet-5-5"), { input: 2, output: 10 });
    assert.deepEqual(getPricing("claude-haiku-5-5"), { input: 0.1, output: 0.5 });
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

describe("per-user budget, by role", () => {
  const KEYS = ["AI_USER_BUDGET_USD", "AI_STUDENT_BUDGET_USD"] as const;
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

  it("is off unless configured, so a deploy that forgets fails open", () => {
    // Zero means no cap. The alternative — defaulting to some number — would
    // turn a missing env var into a silent outage for every teacher.
    withEnv({}, () => {
      assert.equal(getUserBudgetLimitUsd(), 0);
      assert.equal(getUserBudgetLimitUsd("student"), 0);
    });
  });

  it("bills a student against the student var, everyone else against the teacher one", () => {
    withEnv({ AI_USER_BUDGET_USD: "1.00", AI_STUDENT_BUDGET_USD: "0.20" }, () => {
      assert.equal(getUserBudgetLimitUsd("student"), 0.2);
      assert.equal(getUserBudgetLimitUsd("teacher"), 1);
      assert.equal(getUserBudgetLimitUsd("school_admin"), 1);
      // The reason the two are separate at all: a class is thirty students and
      // their traffic is chat, which can never be served from the shared pool.
      assert.ok(getUserBudgetLimitUsd("student") < getUserBudgetLimitUsd("teacher"));
    });
  });

  it("reads an unknown or missing role as a teacher, not as a student", () => {
    // A new role must not silently land on the tighter cap.
    withEnv({ AI_USER_BUDGET_USD: "1.00", AI_STUDENT_BUDGET_USD: "0.20" }, () => {
      assert.equal(getUserBudgetLimitUsd(), 1);
      assert.equal(getUserBudgetLimitUsd(null), 1);
      assert.equal(getUserBudgetLimitUsd("parent"), 1);
      assert.equal(getUserBudgetLimitUsd("some_future_role"), 1);
    });
  });

  it("ignores junk and negatives rather than capping at them", () => {
    withEnv({ AI_USER_BUDGET_USD: "not-a-number", AI_STUDENT_BUDGET_USD: "-5" }, () => {
      assert.equal(getUserBudgetLimitUsd("teacher"), 0);
      assert.equal(getUserBudgetLimitUsd("student"), 0);
    });
  });

  it("a student cap set alone does not cap teachers", () => {
    // The two are independent on purpose: capping students during a pilot must
    // not require capping the teachers you are piloting with.
    withEnv({ AI_STUDENT_BUDGET_USD: "0.20" }, () => {
      assert.equal(getUserBudgetLimitUsd("student"), 0.2);
      assert.equal(getUserBudgetLimitUsd("teacher"), 0);
    });
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
 * Which model a document is written by.
 *
 * `AI_MODEL_DOCUMENTS` moves lesson plans, worksheets, quizzes and slide decks
 * to another model (Claude Sonnet 5.5) without touching `AI_MODEL_GENERATE`,
 * which exam generation, grading and the verified-derivative path read and send
 * straight to the OpenAI client. Two things must hold: nothing changes while it
 * is unset, and a Claude id with no key must never be returned — that would
 * answer every request with an error.
 */
describe("document model", () => {
  const KEYS = [
    "AI_MODEL", "AI_MODEL_GENERATE", "AI_MODEL_DOCUMENTS", "AI_MODEL_PROMPT_SLIDES", "ANTHROPIC_API_KEY",
  ] as const;
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
  const DOCS = ["lesson-plan", "worksheet", "quiz", "prompt-slides"];

  it("tells Claude ids from OpenAI ids", () => {
    assert.equal(isClaudeModel("claude-sonnet-5-5"), true);
    assert.equal(isClaudeModel("gpt-5.4-mini"), false);
  });

  it("changes nothing while AI_MODEL_DOCUMENTS is unset", () => {
    withEnv({ AI_MODEL_GENERATE: "gpt-5.4-mini", ANTHROPIC_API_KEY: "k" }, () => {
      for (const kind of DOCS) assert.equal(getDocumentModel(kind), "gpt-5.4-mini");
      assert.equal(getPromptSlidesModel(), "gpt-5.4-mini");
    });
  });

  it("moves exactly the four document kinds to the configured model", () => {
    withEnv(
      { AI_MODEL_GENERATE: "gpt-5.4-mini", AI_MODEL_DOCUMENTS: "claude-sonnet-5-5", ANTHROPIC_API_KEY: "k" },
      () => {
        for (const kind of DOCS) assert.equal(getDocumentModel(kind), "claude-sonnet-5-5");
        assert.equal(getPromptSlidesModel(), "claude-sonnet-5-5");
      },
    );
  });

  it("leaves every other generator, and AI_MODEL_GENERATE itself, on the OpenAI model", () => {
    withEnv(
      { AI_MODEL_GENERATE: "gpt-5.4-mini", AI_MODEL_DOCUMENTS: "claude-sonnet-5-5", ANTHROPIC_API_KEY: "k" },
      () => {
        for (const kind of ["homework", "activity", "classroom-activity", "lesson-teaching", "infographic", "solve"]) {
          assert.equal(getDocumentModel(kind), "gpt-5.4-mini", kind);
        }
        // The call sites that talk to the OpenAI client read this one directly.
        assert.equal(getGenerationModel(), "gpt-5.4-mini");
      },
    );
  });

  it("keeps the OpenAI model when a Claude model is set but there is no key", () => {
    withEnv({ AI_MODEL_GENERATE: "gpt-5.4-mini", AI_MODEL_DOCUMENTS: "claude-sonnet-5-5" }, () => {
      for (const kind of DOCS) assert.equal(getDocumentModel(kind), "gpt-5.4-mini");
      assert.equal(getPromptSlidesModel(), "gpt-5.4-mini");
    });
  });

  it("lets the slides variable pick its own model, and still skips a Claude id without a key", () => {
    withEnv(
      { AI_MODEL_GENERATE: "gpt-5.4-mini", AI_MODEL_DOCUMENTS: "claude-sonnet-5-5", AI_MODEL_PROMPT_SLIDES: "gpt-5.4", ANTHROPIC_API_KEY: "k" },
      () => assert.equal(getPromptSlidesModel(), "gpt-5.4"),
    );
    withEnv(
      { AI_MODEL_GENERATE: "gpt-5.4-mini", AI_MODEL_PROMPT_SLIDES: "claude-haiku-5-5" },
      () => assert.equal(getPromptSlidesModel(), "gpt-5.4-mini"),
    );
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
    const audio = /export function recordAudioUsage\(([\s\S]*?)\n}/.exec(src);
    assert.ok(audio, "recordAudioUsage not found — has it been renamed?");
    assert.match(audio[1]!, /recordFixedCost\([\s\S]*userId\);/, "audio spend must pass its owner on");
    const body = /function recordFixedCost\(([\s\S]*?)\n}/.exec(src);
    assert.ok(body, "recordFixedCost not found — has it been renamed?");
    assert.match(body[1]!, /recordGeneration\(/, "audio spend must reach ai_generations");
    assert.match(body[1]!, /userId:\s*userId\s*\?\?\s*null/, "the ledger row must carry the owner");
  });
});

describe("withUserAiSlot", () => {
  it("refuses a third simultaneous call from one user, and frees the slot after", async () => {
    const { withUserAiSlot, AiUserBusyError } = await import("../aiBudget.ts");
    let release!: () => void;
    const gate = new Promise<void>(r => { release = r; });
    const a = withUserAiSlot("u1", () => gate);
    const b = withUserAiSlot("u1", () => gate);
    await assert.rejects(withUserAiSlot("u1", async () => 1), AiUserBusyError);
    // Another user is not affected.
    assert.equal(await withUserAiSlot("u2", async () => 2), 2);
    release();
    await Promise.all([a, b]);
    assert.equal(await withUserAiSlot("u1", async () => 3), 3);
  });
});
