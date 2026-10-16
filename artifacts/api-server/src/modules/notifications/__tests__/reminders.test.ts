import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { reminderKind, reminderWindow } from "../reminders.ts";

describe("reminderWindow", () => {
  it("is the Amman day after today, as instants", () => {
    const w = reminderWindow(new Date("2026-10-14T13:00:00Z")); // 16:00 Amman, 14 Oct
    assert.equal(w.dueDate, "2026-10-15");
    assert.equal(w.after.toISOString(), "2026-10-14T20:59:59.999Z"); // end of 14 Oct, Amman
    assert.equal(w.upTo.toISOString(), "2026-10-15T20:59:59.999Z"); // end of 15 Oct, Amman
  });
  it("rolls with the Amman day, not the UTC one", () => {
    assert.equal(reminderWindow(new Date("2026-10-14T20:59:59Z")).dueDate, "2026-10-15"); // 23:59:59 Amman
    assert.equal(reminderWindow(new Date("2026-10-14T21:00:00Z")).dueDate, "2026-10-16"); // 00:00 Amman, 15 Oct
  });
  it("crosses a month and a year", () => {
    assert.equal(reminderWindow(new Date("2026-12-31T10:00:00Z")).dueDate, "2027-01-01");
  });
});

describe("reminderKind", () => {
  it("reminds a child with an account who has not ticked it", () => {
    assert.equal(reminderKind({ hasAccount: true, done: false }), "tracked");
  });
  it("says nothing about a ticked one", () => {
    assert.equal(reminderKind({ hasAccount: true, done: true }), null);
    assert.equal(reminderKind({ hasAccount: false, done: true }), null);
  });
  it("gives a child nobody can tick for the softer reminder", () => {
    assert.equal(reminderKind({ hasAccount: false, done: false }), "untracked");
  });
});
