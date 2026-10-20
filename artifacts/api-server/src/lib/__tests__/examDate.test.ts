/**
 * What this guards: a teacher sets an exam date from a picker on the
 * evaluation screen, and the date then drives the school-wide clash check. A
 * malformed or impossible date (2026-02-30) would silently never match any
 * calendar day, so the exam would vanish from the calendar instead of failing.
 * `null` must clear — the same trap `pickDefined` exists for: treating null as
 * "not provided" makes setting a date work and clearing it do nothing.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { ammanToday, isValidExamDate, parseCalendarRange, resolveExamPatch } from "../examDate.ts";

// 12:00 on 2026-10-12 in Amman. A fixed clock: a new date is judged against
// "today", so a test that sets one must not depend on the day it runs.
const NOW = new Date("2026-10-12T09:00:00Z");

function rejects(fn: () => unknown): string {
  try {
    fn();
  } catch (msg) {
    return String(msg);
  }
  assert.fail("expected the call to throw");
}

const NONE = { examDate: null, examTime: null };

describe("isValidExamDate", () => {
  it("accepts a real calendar date", () => {
    assert.equal(isValidExamDate("2026-10-12"), true);
  });

  it("accepts 29 February only in a leap year", () => {
    assert.equal(isValidExamDate("2028-02-29"), true);
    assert.equal(isValidExamDate("2026-02-29"), false);
  });

  it("rejects a date that does not exist", () => {
    assert.equal(isValidExamDate("2026-02-30"), false);
    assert.equal(isValidExamDate("2026-13-01"), false);
  });

  it("rejects anything that is not zero-padded YYYY-MM-DD", () => {
    assert.equal(isValidExamDate("2026-1-5"), false);
    assert.equal(isValidExamDate("12/10/2026"), false);
    assert.equal(isValidExamDate("2026-10-12T00:00:00Z"), false);
    assert.equal(isValidExamDate(20261012), false);
    assert.equal(isValidExamDate(null), false);
  });
});

describe("resolveExamPatch", () => {
  it("leaves the stored schedule alone when neither field is sent", () => {
    const existing = { examDate: "2026-10-12", examTime: "09:00" };
    assert.deepEqual(resolveExamPatch(existing, {}), existing);
  });

  it("sets a date", () => {
    assert.deepEqual(resolveExamPatch(NONE, { examDate: "2026-10-12" }, NOW), {
      examDate: "2026-10-12",
      examTime: null,
    });
  });

  it("sets a date and a time together", () => {
    assert.deepEqual(resolveExamPatch(NONE, { examDate: "2026-10-12", examTime: "09:30" }, NOW), {
      examDate: "2026-10-12",
      examTime: "09:30",
    });
  });

  it("accepts today and any later day, refuses yesterday", () => {
    assert.equal(resolveExamPatch(NONE, { examDate: "2026-10-12" }, NOW).examDate, "2026-10-12");
    assert.equal(resolveExamPatch(NONE, { examDate: "2027-01-01" }, NOW).examDate, "2027-01-01");
    assert.match(rejects(() => resolveExamPatch(NONE, { examDate: "2026-10-11" }, NOW)), /today or later/);
  });

  it("judges the day in Amman: just after 21:00Z it is already tomorrow there", () => {
    const late = new Date("2026-10-12T21:30:00Z"); // 00:30 on 2026-10-13 in Amman
    assert.match(rejects(() => resolveExamPatch(NONE, { examDate: "2026-10-12" }, late)), /today or later/);
    assert.equal(resolveExamPatch(NONE, { examDate: "2026-10-13" }, late).examDate, "2026-10-13");
    assert.equal(ammanToday(late), "2026-10-13");
  });

  it("refuses to MOVE a stored date into the past, but a stored past date can be re-sent, re-timed or cleared", () => {
    const old = { examDate: "2026-09-01", examTime: null };
    assert.match(rejects(() => resolveExamPatch(old, { examDate: "2026-09-02" }, NOW)), /today or later/);
    assert.deepEqual(resolveExamPatch(old, { examDate: "2026-09-01", examTime: "10:00" }, NOW), {
      examDate: "2026-09-01",
      examTime: "10:00",
    });
    assert.deepEqual(resolveExamPatch(old, { examTime: "10:00" }, NOW), { examDate: "2026-09-01", examTime: "10:00" });
    assert.deepEqual(resolveExamPatch(old, { examDate: null }, NOW), NONE);
    assert.equal(resolveExamPatch(old, { examDate: "2026-10-20" }, NOW).examDate, "2026-10-20", "moving it forward is fine");
  });

  it("changes the time of an already-dated exam", () => {
    const existing = { examDate: "2026-10-12", examTime: null };
    assert.deepEqual(resolveExamPatch(existing, { examTime: "10:15" }), {
      examDate: "2026-10-12",
      examTime: "10:15",
    });
  });

  it("clears the date on null", () => {
    const existing = { examDate: "2026-10-12", examTime: null };
    assert.deepEqual(resolveExamPatch(existing, { examDate: null }), NONE);
  });

  it("clears the time too when the date is cleared — a time without a day means nothing", () => {
    const existing = { examDate: "2026-10-12", examTime: "09:00" };
    assert.deepEqual(resolveExamPatch(existing, { examDate: null }), NONE);
  });

  it("clears only the time on a null time", () => {
    const existing = { examDate: "2026-10-12", examTime: "09:00" };
    assert.deepEqual(resolveExamPatch(existing, { examTime: null }), {
      examDate: "2026-10-12",
      examTime: null,
    });
  });

  it("refuses a time on an exam that has no date", () => {
    assert.match(rejects(() => resolveExamPatch(NONE, { examTime: "09:00" })), /examDate/);
  });

  it("refuses an invalid date with a message naming the field", () => {
    assert.match(rejects(() => resolveExamPatch(NONE, { examDate: "2026-02-30" })), /examDate/);
    assert.match(rejects(() => resolveExamPatch(NONE, { examDate: 5 })), /examDate/);
  });

  it("refuses an invalid time", () => {
    const existing = { examDate: "2026-10-12", examTime: null };
    assert.match(rejects(() => resolveExamPatch(existing, { examTime: "24:00" })), /examTime/);
    assert.match(rejects(() => resolveExamPatch(existing, { examTime: "9:00" })), /examTime/);
    assert.match(rejects(() => resolveExamPatch(existing, { examTime: 900 })), /examTime/);
  });
});

describe("parseCalendarRange", () => {
  it("accepts a month-sized window", () => {
    assert.deepEqual(parseCalendarRange({ from: "2026-09-27", to: "2026-11-07" }), {
      from: "2026-09-27",
      to: "2026-11-07",
    });
  });

  it("accepts a single day", () => {
    assert.deepEqual(parseCalendarRange({ from: "2026-10-12", to: "2026-10-12" }), {
      from: "2026-10-12",
      to: "2026-10-12",
    });
  });

  it("requires both ends", () => {
    assert.match(rejects(() => parseCalendarRange({ from: "2026-10-12" })), /from and to/);
    assert.match(rejects(() => parseCalendarRange({})), /from and to/);
  });

  it("refuses a bad date on either end", () => {
    assert.match(rejects(() => parseCalendarRange({ from: "2026-02-30", to: "2026-03-05" })), /from/);
    assert.match(rejects(() => parseCalendarRange({ from: "2026-03-01", to: "soon" })), /to/);
  });

  it("refuses a window that ends before it starts", () => {
    assert.match(rejects(() => parseCalendarRange({ from: "2026-10-13", to: "2026-10-12" })), /before/);
  });

  it("refuses a window longer than a year, so one call cannot sweep a whole school's history", () => {
    assert.match(rejects(() => parseCalendarRange({ from: "2026-01-01", to: "2027-06-01" })), /366/);
    assert.deepEqual(parseCalendarRange({ from: "2026-01-01", to: "2026-12-31" }).to, "2026-12-31");
  });
});
