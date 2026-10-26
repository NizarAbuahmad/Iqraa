/**
 * The public bot's own daily spend ceiling.
 *
 * It must not be a counter in this process: the API runs on up to 20 Cloud Run
 * instances, so a per-instance counter would allow 20 times the cap. The real
 * read is a sum over ai_generations (not exercised here — it needs a database);
 * these tests pin the gate around it: closed at the cap, closed when the total
 * is unknown, off at 0, and not re-read on every request.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createSiteAskSpendGate,
  estimateCostUsd,
  getSiteAskDailyCapUsd,
  SITE_ASK_DEFAULT_DAILY_CAP_USD,
  SITE_ASK_KIND,
  SITE_ASK_SPEND_TTL_MS,
} from "../siteAskBudget.ts";

describe("getSiteAskDailyCapUsd", () => {
  it("defaults to one dollar when unset, blank or not a number", () => {
    assert.equal(SITE_ASK_DEFAULT_DAILY_CAP_USD, 1);
    for (const raw of [undefined, "", "   ", "abc", "-3", "NaN", "Infinity"]) {
      assert.equal(getSiteAskDailyCapUsd(raw), 1, String(raw));
    }
  });

  it("reads a configured cap, and 0 is a real value that turns the bot off", () => {
    assert.equal(getSiteAskDailyCapUsd("0.5"), 0.5);
    assert.equal(getSiteAskDailyCapUsd("3"), 3);
    assert.equal(getSiteAskDailyCapUsd("0"), 0);
  });

  it("uses a kind the dashboard can group by", () => {
    assert.equal(SITE_ASK_KIND, "site-ask");
  });
});

describe("createSiteAskSpendGate", () => {
  function setup(opts: { spent: number | null; cap: number; ledgerHealthy?: () => boolean }) {
    let t = 5_000_000;
    let reads = 0;
    let spent = opts.spent;
    const gate = createSiteAskSpendGate({
      read: async () => {
        reads += 1;
        return spent;
      },
      capUsd: () => opts.cap,
      now: () => t,
      ...(opts.ledgerHealthy ? { ledgerHealthy: opts.ledgerHealthy } : {}),
    });
    return {
      gate,
      reads: () => reads,
      advance: (ms: number) => void (t += ms),
      setSpent: (v: number | null) => void (spent = v),
    };
  }

  it("is open while spend is under the cap", async () => {
    const s = setup({ spent: 0.4, cap: 1 });
    assert.equal(await s.gate.isOpen(), true);
  });

  it("is closed at the cap and over it", async () => {
    assert.equal(await setup({ spent: 1, cap: 1 }).gate.isOpen(), false);
    assert.equal(await setup({ spent: 7.5, cap: 1 }).gate.isOpen(), false);
  });

  it("is closed when the total cannot be read — unknown is not zero", async () => {
    assert.equal(await setup({ spent: null, cap: 1 }).gate.isOpen(), false);
  });

  it("with a cap of 0 is closed and never reads the database", async () => {
    const s = setup({ spent: 0, cap: 0 });
    assert.equal(await s.gate.isOpen(), false);
    assert.equal(s.reads(), 0);
  });

  it("reads once a minute, not on every request", async () => {
    const s = setup({ spent: 0.1, cap: 1 });
    await s.gate.isOpen();
    await s.gate.isOpen();
    s.advance(SITE_ASK_SPEND_TTL_MS - 1);
    await s.gate.isOpen();
    assert.equal(s.reads(), 1);
    s.setSpent(2);
    s.advance(2);
    assert.equal(await s.gate.isOpen(), false);
    assert.equal(s.reads(), 2);
  });

  it("add() closes the gate inside the TTL without re-reading", async () => {
    const s = setup({ spent: 0.9, cap: 1 });
    assert.equal(await s.gate.isOpen(), true);
    s.gate.add(0.2);
    assert.equal(await s.gate.isOpen(), false);
    assert.equal(s.reads(), 1);
  });

  it("add() before any read is a no-op: the first isOpen() still reads once", async () => {
    const s = setup({ spent: 0.1, cap: 1 });
    s.gate.add(5);
    assert.equal(s.reads(), 0);
    assert.equal(await s.gate.isOpen(), true);
    assert.equal(s.reads(), 1);
  });

  it("add() after a null read is a no-op: unknown stays closed", async () => {
    const s = setup({ spent: null, cap: 1 });
    assert.equal(await s.gate.isOpen(), false);
    s.gate.add(0.1);
    assert.equal(await s.gate.isOpen(), false);
    assert.equal(s.reads(), 1);
  });

  it("add() ignores zero, negative, NaN and Infinity", async () => {
    const s = setup({ spent: 0.9, cap: 1 });
    assert.equal(await s.gate.isOpen(), true);
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      s.gate.add(bad);
      assert.equal(await s.gate.isOpen(), true, String(bad));
    }
  });

  it("after the TTL the database figure replaces the in-process total", async () => {
    const s = setup({ spent: 0.9, cap: 1 });
    await s.gate.isOpen();
    s.gate.add(0.2);
    assert.equal(await s.gate.isOpen(), false);
    s.setSpent(0.3);
    s.advance(SITE_ASK_SPEND_TTL_MS + 1);
    assert.equal(await s.gate.isOpen(), true);
    assert.equal(s.reads(), 2);
  });

  it("is closed, without reading, while the ledger cannot be written", async () => {
    let healthy = false;
    const s = setup({ spent: 0.1, cap: 1, ledgerHealthy: () => healthy });
    assert.equal(await s.gate.isOpen(), false);
    assert.equal(s.reads(), 0);
    healthy = true;
    assert.equal(await s.gate.isOpen(), true);
    assert.equal(s.reads(), 1);
  });
});

describe("estimateCostUsd", () => {
  const pricing = { input: 0.75, output: 4.5 };

  it("is prompt and completion tokens at the per-million rates", () => {
    const x = estimateCostUsd({ prompt_tokens: 8000, completion_tokens: 800 }, pricing);
    assert.ok(Math.abs(x - 0.0096) < 1e-9, String(x));
  });

  it("counts a missing, null or non-finite part as 0", () => {
    assert.equal(estimateCostUsd(undefined, pricing), 0);
    assert.equal(estimateCostUsd(null, pricing), 0);
    assert.equal(estimateCostUsd({}, pricing), 0);
    const onlyPrompt = estimateCostUsd({ prompt_tokens: 1_000_000 }, pricing);
    assert.ok(Math.abs(onlyPrompt - 0.75) < 1e-9);
    const onlyOut = estimateCostUsd({ completion_tokens: 1_000_000 }, pricing);
    assert.ok(Math.abs(onlyOut - 4.5) < 1e-9);
    assert.equal(estimateCostUsd({ prompt_tokens: Number.NaN, completion_tokens: Number.POSITIVE_INFINITY }, pricing), 0);
  });
});
