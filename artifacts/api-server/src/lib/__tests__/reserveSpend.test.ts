/**
 * Check-and-hold, not check-then-spend.
 *
 * Both AI caps used to read a total, compare, and only learn about a call once
 * it finished — so fifteen parallel prompt-slides requests all read the same
 * total and all went through. `reserveSpend` holds each call's estimate from
 * the moment it is admitted until it is settled.
 *
 * The per-user hold lives in Postgres (an advisory-locked insert in
 * `reserveUserSpend`); the stand-in below gives the same guarantee the lock
 * does — one reservation decided at a time — so what is tested is everything
 * on our side of it. The SQL itself was run against a scratch Postgres on
 * 2026-10-09 with 15 concurrent connections (4 admitted, 11 refused).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  AiBudgetExceededError,
  AiUserQuotaExceededError,
  audioCostUsd,
  estimateCompletionUsd,
  getPricing,
  IMAGE_USD_PER_IMAGE,
  reserveSpend,
  type UserSpendLedger,
} from "../aiBudget.ts";

const KEYS = ["AI_BUDGET_USD", "AI_USER_BUDGET_USD", "AI_STUDENT_BUDGET_USD"] as const;

async function withEnv(env: Partial<Record<(typeof KEYS)[number], string>>, fn: () => Promise<void>) {
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  try {
    for (const k of KEYS) delete process.env[k];
    for (const [k, v] of Object.entries(env)) process.env[k] = v;
    await fn();
  } finally {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k]!;
    }
  }
}

/** The SQL's semantics, serialised the way the advisory lock serialises it. */
function serialisedLedger(spentUsd = 0) {
  const held = new Map<string, number>();
  let queue: Promise<unknown> = Promise.resolve();
  let next = 0;
  const releases: string[] = [];
  const ledger: UserSpendLedger = {
    reserve: (_userId, limitUsd, estimateUsd) => {
      const decided = queue.then(async () => {
        await new Promise((r) => setTimeout(r, 1)); // a real round trip
        const committedUsd = spentUsd + [...held.values()].reduce((a, b) => a + b, 0);
        if (committedUsd >= limitUsd) return { ok: false as const, committedUsd };
        const id = `r${next++}`;
        held.set(id, estimateUsd);
        return { ok: true as const, id };
      });
      queue = decided;
      return decided;
    },
    release: async (id) => {
      releases.push(id);
      held.delete(id);
    },
  };
  return { ledger, held, releases };
}

describe("reserveSpend — per-user allowance", () => {
  it("lets only as many parallel calls through as the allowance can hold", async () => {
    await withEnv({ AI_BUDGET_USD: "1000", AI_USER_BUDGET_USD: "1.00" }, async () => {
      const { ledger } = serialisedLedger();
      // The reported case: fifteen prompt-slides at once, ~$0.30 each.
      const results = await Promise.allSettled(
        Array.from({ length: 15 }, () => reserveSpend("teacher-1", "teacher", 0.3, ledger)),
      );
      const admitted = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<() => void>[];
      const refused = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
      // 0, 0.3, 0.6, 0.9 held are under $1; the fifth sees $1.20 held.
      assert.equal(admitted.length, 4);
      assert.equal(refused.length, 11);
      for (const r of refused) assert.ok(r.reason instanceof AiUserQuotaExceededError);
      for (const r of admitted) r.value();
    });
  });

  it("frees the hold on release, once, however often release is called", async () => {
    await withEnv({ AI_BUDGET_USD: "1000", AI_USER_BUDGET_USD: "1.00" }, async () => {
      const { ledger, held, releases } = serialisedLedger();
      const release = await reserveSpend("teacher-1", "teacher", 0.5, ledger);
      assert.equal(held.size, 1);
      release();
      release();
      await new Promise((r) => setTimeout(r, 0));
      assert.equal(held.size, 0);
      assert.equal(releases.length, 1);
    });
  });

  it("refuses a teacher already at their allowance without holding anything", async () => {
    await withEnv({ AI_BUDGET_USD: "1000", AI_USER_BUDGET_USD: "1.00" }, async () => {
      const { ledger, held } = serialisedLedger(1.0);
      await assert.rejects(reserveSpend("teacher-1", "teacher", 0.01, ledger), AiUserQuotaExceededError);
      assert.equal(held.size, 0);
    });
  });

  it("checks a student against the student allowance", async () => {
    await withEnv({ AI_BUDGET_USD: "1000", AI_USER_BUDGET_USD: "5.00", AI_STUDENT_BUDGET_USD: "0.20" }, async () => {
      const { ledger } = serialisedLedger(0.25);
      await assert.rejects(reserveSpend("student-1", "student", 0.01, ledger), AiUserQuotaExceededError);
    });
  });

  it("skips the ledger when no allowance is configured", async () => {
    await withEnv({ AI_BUDGET_USD: "1000" }, async () => {
      let asked = false;
      const ledger: UserSpendLedger = {
        reserve: async () => {
          asked = true;
          return null;
        },
        release: async () => {},
      };
      (await reserveSpend("teacher-1", "teacher", 0.5, ledger))();
      assert.equal(asked, false);
    });
  });

  it("does not block when the ledger cannot be read", async () => {
    // A database blip must not refuse every teacher; the global cap still holds.
    await withEnv({ AI_BUDGET_USD: "1000", AI_USER_BUDGET_USD: "1.00" }, async () => {
      const ledger: UserSpendLedger = { reserve: async () => null, release: async () => {} };
      (await reserveSpend("teacher-1", "teacher", 0.5, ledger))();
    });
  });
});

describe("reserveSpend — global cap", () => {
  it("holds across parallel calls in this process", async () => {
    await withEnv({ AI_BUDGET_USD: "1.00" }, async () => {
      const results = await Promise.allSettled(Array.from({ length: 6 }, () => reserveSpend(null, null, 0.4)));
      const admitted = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<() => void>[];
      // 0, 0.4, 0.8 held are under $1.
      assert.equal(admitted.length, 3);
      for (const r of results.filter((r) => r.status === "rejected") as PromiseRejectedResult[]) {
        assert.ok(r.reason instanceof AiBudgetExceededError);
      }
      for (const r of admitted) r.value();
      // Released holds give the room back.
      (await reserveSpend(null, null, 0.4))();
    });
  });

  it("gives the global room back when the per-user cap refuses", async () => {
    await withEnv({ AI_BUDGET_USD: "1.00", AI_USER_BUDGET_USD: "1.00" }, async () => {
      const { ledger } = serialisedLedger(5);
      for (let i = 0; i < 5; i++) {
        await assert.rejects(reserveSpend("teacher-1", "teacher", 0.4, ledger), AiUserQuotaExceededError);
      }
      // Had each refusal leaked its 0.4, this would now be a budget refusal.
      (await reserveSpend(null, null, 0.4))();
    });
  });
});

describe("spend estimates", () => {
  it("cover a completion's whole output ceiling", () => {
    const { output } = getPricing("gpt-5.4-mini");
    assert.ok(estimateCompletionUsd("gpt-5.4-mini", 16000) >= (16000 / 1_000_000) * output);
  });

  it("grow with the prompt", () => {
    assert.ok(estimateCompletionUsd("gpt-5.4-mini", 1000, 400_000) > estimateCompletionUsd("gpt-5.4-mini", 1000));
  });

  it("price audio by measured seconds, and nonsense as nothing", () => {
    assert.ok(audioCostUsd(120) > audioCostUsd(60));
    for (const s of [-1, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(audioCostUsd(s), 0);
  });

  it("bill an image at no less than gpt-image-1's top 1024px tier", () => {
    assert.ok(IMAGE_USD_PER_IMAGE >= 0.167);
  });
});

describe("every model call goes through a reservation (structural)", () => {
  // These routes import `@workspace/db` at module scope and cannot load under
  // `node --test`, so the wiring is pinned by source, as aiBudget.test.ts does
  // for the audio ledger row.
  const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

  it("reserves and records every generated image", () => {
    const src = read("../../routes/generate.ts");
    const at = src.indexOf("generateImageBuffer(mediaPrompt)");
    assert.ok(at > 0, "image call not found — renamed?");
    assert.match(src.slice(Math.max(0, at - 200), at), /withReservedSpend\(userId, null, IMAGE_USD_PER_IMAGE/);
    assert.match(src.slice(at, at + 200), /recordImageUsage\(/);
  });

  it("leaves no check-only cap call behind", () => {
    for (const rel of [
      "../../routes/generate.ts",
      "../../routes/chat.ts",
      "../../routes/attempts.ts",
      "../../routes/evaluations.ts",
      "../../routes/practice.ts",
      "../../routes/studentAttempt.ts",
      "../derivativeVerified.ts",
    ]) {
      const src = read(rel);
      assert.doesNotMatch(src, /assertUserQuotaAvailable|assertBudgetAvailable/, rel);
      assert.match(src, /reserveSpend|withReservedSpend/, rel);
    }
  });
});
