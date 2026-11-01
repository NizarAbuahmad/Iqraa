import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { ammanDay, buildDailySeries, DEFAULT_DAYS, MAX_DAYS, parseDays } from "../dailyActivity.ts";

describe("parseDays", () => {
  it("defaults when absent and accepts a whole number in range", () => {
    assert.deepEqual(parseDays(undefined), { days: DEFAULT_DAYS });
    assert.deepEqual(parseDays("7"), { days: 7 });
    assert.deepEqual(parseDays(String(MAX_DAYS)), { days: MAX_DAYS });
  });
  it("rejects zero, negatives, fractions, text, arrays and a window past the cap", () => {
    for (const bad of ["0", "-3", "1.5", "abc", "", ["7"], String(MAX_DAYS + 1)]) {
      assert.ok("error" in parseDays(bad), `expected ${JSON.stringify(bad)} to be refused`);
    }
  });
});

describe("ammanDay", () => {
  it("names the calendar day in Amman (UTC+3), not in UTC", () => {
    // 21:30 UTC is already the next morning in Amman.
    assert.equal(ammanDay(new Date("2026-10-31T21:30:00Z")), "2026-11-01");
    assert.equal(ammanDay(new Date("2026-10-31T20:59:59Z")), "2026-10-31");
  });
});

describe("buildDailySeries", () => {
  it("returns one entry per day, oldest first, ending on the given day, with zeros for quiet days", () => {
    const series = buildDailySeries("2026-11-03", 4, [], []);
    assert.deepEqual(
      series.map((d) => d.day),
      ["2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03"],
    );
    for (const d of series) assert.deepEqual({ ...d, day: "" }, { day: "", active: 0, new: 0, returning: 0, signups: 0 });
  });

  it("places each row on its day and ignores rows outside the window", () => {
    const series = buildDailySeries(
      "2026-11-02",
      2,
      [
        { day: "2026-11-01", active: 5, newUsers: 2, returningUsers: 3 },
        { day: "2026-11-02", active: 1, newUsers: 0, returningUsers: 1 },
        { day: "2026-10-01", active: 99, newUsers: 99, returningUsers: 0 },
      ],
      [
        { day: "2026-11-01", count: 4 },
        { day: "2026-09-01", count: 50 },
      ],
    );
    assert.deepEqual(series, [
      { day: "2026-11-01", active: 5, new: 2, returning: 3, signups: 4 },
      { day: "2026-11-02", active: 1, new: 0, returning: 1, signups: 0 },
    ]);
  });

  it("walks across a month and a year boundary", () => {
    const series = buildDailySeries("2027-01-02", 4, [], []);
    assert.deepEqual(
      series.map((d) => d.day),
      ["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"],
    );
  });
});
