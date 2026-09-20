/**
 * What this guards: a teacher's period timetable is set up by hand, one field
 * at a time (a time typed into a box, a class picked from a dropdown), so the
 * validators here are what stands between that input and two unique-indexed
 * tables. A malformed `startTime` or `periodNumber` reaching drizzle would
 * surface as an opaque database error instead of a clear 400.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_DURATION_MINUTES,
  MAX_NOTES_LENGTH,
  MAX_PERIOD_NUMBER,
  isValidDayOfWeek,
  isValidDurationMinutes,
  isValidPeriodNumber,
  isValidTimeOfDay,
  parsePeriodInput,
  parseSlotInput,
} from "../schedule.ts";

function rejects(fn: () => unknown): string {
  try {
    fn();
  } catch (msg) {
    return String(msg);
  }
  throw new Error("expected a rejection");
}

describe("isValidPeriodNumber", () => {
  it("accepts the boundary values", () => {
    assert.equal(isValidPeriodNumber(1), true);
    assert.equal(isValidPeriodNumber(MAX_PERIOD_NUMBER), true);
  });

  it("rejects zero, negatives, fractions, and past the ceiling", () => {
    for (const n of [0, -1, 1.5, MAX_PERIOD_NUMBER + 1, "3", null]) {
      assert.equal(isValidPeriodNumber(n), false);
    }
  });
});

describe("isValidDayOfWeek", () => {
  it("accepts 0 through 6", () => {
    for (let d = 0; d <= 6; d++) assert.equal(isValidDayOfWeek(d), true);
  });

  it("rejects out of range or non-integer", () => {
    for (const d of [-1, 7, 2.5, "2", null]) assert.equal(isValidDayOfWeek(d), false);
  });
});

describe("isValidTimeOfDay", () => {
  it("accepts valid 24-hour HH:MM", () => {
    for (const t of ["00:00", "09:05", "23:59"]) assert.equal(isValidTimeOfDay(t), true);
  });

  it("rejects malformed or out-of-range times", () => {
    for (const t of ["24:00", "9:05", "09:60", "9:5", "", 930, null]) {
      assert.equal(isValidTimeOfDay(t), false);
    }
  });
});

describe("isValidDurationMinutes", () => {
  it("accepts the boundary values", () => {
    assert.equal(isValidDurationMinutes(1), true);
    assert.equal(isValidDurationMinutes(MAX_DURATION_MINUTES), true);
  });

  it("rejects zero, fractions, and past the ceiling", () => {
    for (const n of [0, 1.5, MAX_DURATION_MINUTES + 1, "45", null]) {
      assert.equal(isValidDurationMinutes(n), false);
    }
  });
});

describe("parsePeriodInput", () => {
  it("passes a well-formed period through, defaulting duration to 45", () => {
    assert.deepEqual(parsePeriodInput({ startTime: "08:00" }), { startTime: "08:00", durationMinutes: 45 });
    assert.deepEqual(
      parsePeriodInput({ startTime: "08:00", durationMinutes: 40 }),
      { startTime: "08:00", durationMinutes: 40 },
    );
  });

  it("rejects a non-object body", () => {
    for (const bad of [null, "x", 5, undefined]) {
      assert.match(rejects(() => parsePeriodInput(bad)), /must be an object/);
    }
  });

  it("rejects a missing or malformed startTime", () => {
    assert.match(rejects(() => parsePeriodInput({})), /startTime must be/);
    assert.match(rejects(() => parsePeriodInput({ startTime: "9:00" })), /startTime must be/);
  });

  it("rejects an out-of-range duration", () => {
    assert.match(
      rejects(() => parsePeriodInput({ startTime: "08:00", durationMinutes: 0 })),
      /durationMinutes must be/,
    );
  });
});

describe("parseSlotInput", () => {
  it("passes a well-formed slot through", () => {
    assert.deepEqual(
      parseSlotInput({ classGroupId: "c1", notes: "احضر الآلة الحاسبة" }),
      { classGroupId: "c1", notes: "احضر الآلة الحاسبة" },
    );
  });

  it("allows clearing a slot with a null classGroupId", () => {
    assert.deepEqual(parseSlotInput({ classGroupId: null }), { classGroupId: null, notes: undefined });
  });

  it("allows omitting both fields", () => {
    assert.deepEqual(parseSlotInput({}), { classGroupId: undefined, notes: undefined });
  });

  it("rejects a non-object body", () => {
    assert.match(rejects(() => parseSlotInput(null)), /must be an object/);
  });

  it("rejects a non-string, non-null classGroupId", () => {
    assert.match(rejects(() => parseSlotInput({ classGroupId: 5 })), /classGroupId must be/);
  });

  it("rejects notes over the length cap", () => {
    assert.match(
      rejects(() => parseSlotInput({ notes: "a".repeat(MAX_NOTES_LENGTH + 1) })),
      /at most 500 characters/,
    );
  });
});
