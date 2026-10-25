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
  function setup(opts: { spent: number | null; cap: number }) {
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
});
