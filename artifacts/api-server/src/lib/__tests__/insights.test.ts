import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  breakdown,
  buildCohorts,
  MIN_GROUP,
  multiValueBreakdown,
  parseInsightsDays,
  summarizeActivity,
  weekStartOf,
} from "../insights.ts";

describe("summarizeActivity", () => {
  const end = "2026-11-19";
  const rows = [
    // a: active on 2 days in the last 7 → returning
    { userId: "a", day: "2026-11-18" },
    { userId: "a", day: "2026-11-19" },
    // b: once in the last 7 → active, not returning
    { userId: "b", day: "2026-11-17" },
    // c: active 20 days ago only → not active in 7; churned (seen in the 30 days before the last 14, not since)
    { userId: "c", day: "2026-10-30" },
    // d: active 20 days ago and 3 days ago → not churned
    { userId: "d", day: "2026-10-30" },
    { userId: "d", day: "2026-11-16" },
    // e: active 60 days ago only → outside the churn window
    { userId: "e", day: "2026-09-20" },
  ];
  it("counts active, returning and churned people, and active days per person in the period", () => {
    const s = summarizeActivity(rows, end, 7);
    assert.equal(s.active, 3);
    assert.equal(s.returning, 1);
    assert.equal(s.churned, 1);
    assert.deepEqual(Object.fromEntries(s.activeDays), { a: 2, b: 1, d: 1 });
  });
  it("widens with the period", () => {
    const s = summarizeActivity(rows, end, 30);
    assert.equal(s.active, 4);
    assert.equal(s.returning, 2); // a, d
  });
});

describe("parseInsightsDays", () => {
  it("takes 7, 30 or 90 and defaults to 30", () => {
    assert.deepEqual(parseInsightsDays(undefined), { days: 30 });
    assert.deepEqual(parseInsightsDays("7"), { days: 7 });
    assert.deepEqual(parseInsightsDays("90"), { days: 90 });
  });
  it("refuses anything else", () => {
    for (const raw of ["0", "14", "365", "abc", ["7"]]) assert.ok("error" in parseInsightsDays(raw), String(raw));
  });
});

describe("breakdown", () => {
  it("hides a group of one or two people, keeps three-plus, and then hides both totals", () => {
    assert.equal(MIN_GROUP, 3);
    const out = breakdown([
      { key: "amman", count: 12 },
      { key: "irbid", count: 2 },
      { key: "karak", count: 1 },
      { key: "zarqa", count: 3 },
      { key: null, count: 40 },
    ]);
    assert.deepEqual(out, {
      answered: null,
      unanswered: null,
      rows: [
        { key: "amman", count: 12 },
        { key: "zarqa", count: 3 },
        { key: "irbid", count: null },
        { key: "karak", count: null },
      ],
    });
  });
  it("gives no total from which one hidden cell could be subtracted", () => {
    // male 10, female <3: with answered 12 shown, female would be 2; with unanswered 30 and 42
    // teachers on the page, the same.
    const out = breakdown([{ key: "male", count: 10 }, { key: "female", count: 2 }, { key: null, count: 30 }]);
    assert.deepEqual(out, { answered: null, unanswered: null, rows: [{ key: "male", count: 10 }, { key: "female", count: null }] });
  });
  it("shows both totals when nothing is hidden", () => {
    const out = breakdown([{ key: "male", count: 10 }, { key: "female", count: 4 }, { key: null, count: 30 }]);
    assert.deepEqual([out.answered, out.unanswered], [14, 30]);
  });
});

describe("multiValueBreakdown", () => {
  it("counts a teacher of two subjects once in who answered", () => {
    const out = multiValueBreakdown(
      [
        { key: "mathematics", count: 4 },
        { key: "physics", count: 3 },
      ],
      5,
      6,
    );
    assert.deepEqual(out, {
      answered: 5,
      unanswered: 1,
      rows: [
        { key: "mathematics", count: 4 },
        { key: "physics", count: 3 },
      ],
    });
  });
  it("hides both totals when a value is held by one or two teachers", () => {
    const out = multiValueBreakdown([{ key: "mathematics", count: 4 }, { key: "arabic", count: 1 }], 5, 6);
    assert.deepEqual([out.answered, out.unanswered], [null, null]);
  });
});

describe("weekStartOf", () => {
  it("is the Sunday a day's week starts on (the Jordanian school week)", () => {
    assert.equal(weekStartOf("2026-11-19"), "2026-11-15"); // a Thursday
    assert.equal(weekStartOf("2026-11-15"), "2026-11-15"); // a Sunday
    assert.equal(weekStartOf("2026-11-21"), "2026-11-15"); // a Saturday
  });
});

describe("buildCohorts", () => {
  it("gives each sign-up week its size and how many were active in each later week, up to now", () => {
    const out = buildCohorts(
      "2026-11-15",
      3,
      [
        { userId: "a", signupWeek: "2026-11-01" },
        { userId: "b", signupWeek: "2026-11-01" },
        { userId: "c", signupWeek: "2026-11-08" },
      ],
      [
        { userId: "a", week: "2026-11-01" },
        { userId: "a", week: "2026-11-08" },
        { userId: "b", week: "2026-11-15" },
        { userId: "c", week: "2026-11-15" },
        { userId: "z", week: "2026-11-15" }, // not in any cohort: ignored
      ],
    );
    assert.deepEqual(out, [
      { week: "2026-11-01", size: 2, active: [1, 1, 1] },
      { week: "2026-11-08", size: 1, active: [0, 1] },
      { week: "2026-11-15", size: 0, active: [0] },
    ]);
  });
});
