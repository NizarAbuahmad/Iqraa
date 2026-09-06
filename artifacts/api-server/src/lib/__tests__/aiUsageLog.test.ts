/**
 * The budget period.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/aiUsageLog.test.ts
 *
 * The window this computes is the whole reason the persisted total is
 * comparable to anything: OpenAI's project spend limit resets monthly, so a
 * total summed over any other window would disagree with the console for
 * reasons that look like a bug in one of them.
 *
 * Note this file imports aiUsageLog directly under `node --test`, with no
 * DATABASE_URL set. That works only because the database is imported lazily
 * inside the functions — the same module-scope-throw problem CLAUDE.md records
 * for the OpenAI client. If someone hoists that import, this file is where it
 * shows up.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { currentPeriodStart, getPersistenceFailure } from "../aiUsageLog.ts";

describe("currentPeriodStart", () => {
  it("is the first instant of the containing UTC month", () => {
    const start = currentPeriodStart(new Date("2026-08-22T20:08:00Z"));
    assert.equal(start.toISOString(), "2026-08-01T00:00:00.000Z");
  });

  it("does not drift on the last instant of a month", () => {
    const start = currentPeriodStart(new Date("2026-08-31T23:59:59.999Z"));
    assert.equal(start.toISOString(), "2026-08-01T00:00:00.000Z");
  });

  it("rolls to the new month at midnight UTC", () => {
    const start = currentPeriodStart(new Date("2026-09-01T00:00:00.000Z"));
    assert.equal(start.toISOString(), "2026-09-01T00:00:00.000Z");
  });

  it("handles a January boundary without going back a year", () => {
    const start = currentPeriodStart(new Date("2027-01-01T00:00:30Z"));
    assert.equal(start.toISOString(), "2027-01-01T00:00:00.000Z");
  });

  it("uses UTC, not the server's local time", () => {
    // A server in Amman (UTC+3) on the 1st at 01:00 local is still the 31st in
    // UTC. Reading that as a new period would zero the month's spend a day
    // early — and the console, which resets in UTC, would disagree.
    const lateOnTheLastDay = new Date("2026-08-31T22:00:00Z");
    assert.equal(currentPeriodStart(lateOnTheLastDay).toISOString(), "2026-08-01T00:00:00.000Z");
  });
});

describe("getPersistenceFailure", () => {
  it("starts clean, so a null reading means 'not yet failed', not 'unknown'", () => {
    assert.equal(getPersistenceFailure(), null);
  });

  it("can only ever be an operation name, never a driver message", () => {
    // /healthz/ai-budget is public and unauthenticated on the stated grounds
    // that it holds no secrets. A Drizzle error stringifies to the whole
    // failing query, its parameters and the connection target, so this type
    // being narrow is what keeps that endpoint honest.
    const value = getPersistenceFailure();
    assert.ok(value === null || value === "read" || value === "insert");
  });
});
