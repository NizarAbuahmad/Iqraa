/**
 * What this guards: a letter counted as read because the parent opened the
 * thread, not the letter.
 *
 * `read` on an in-app letter used to be "the guardian's thread-level
 * lastReadAt is at or after the letter". One thread carries every child of
 * that parent and every message from that teacher, and the parent's thread
 * screen polls the mark-read endpoint every ten seconds while open — so one
 * open of the thread, for any reason, marked every pending letter read. The
 * rule here reads the letter's own messages, and falls back to the old
 * thread-level answer only for letters logged before messages were recorded.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { letterReadState } from "../parentContactRead.ts";

const T0 = new Date("2026-10-02T09:00:00Z");
const T1 = new Date("2026-10-02T10:05:00Z");

describe("letterReadState", () => {
  it("is null for a shared or copied letter — the text left the app", () => {
    const [shared, copied] = letterReadState(
      [
        { studentId: "s1", channel: "share", createdAt: T0, messageIds: null },
        { studentId: "s1", channel: "copy", createdAt: T0, messageIds: null },
      ],
      new Set(["m1"]),
      new Map([["s1", T1]]),
    );
    assert.equal(shared!.read, null);
    assert.equal(copied!.read, null);
  });

  it("reads the letter's own message, not the thread", () => {
    // Thread opened at 10:05 (legacy map says so), but the letter's message
    // was never marked read: this is the case that used to come back true.
    const [row] = letterReadState(
      [{ studentId: "s1", channel: "in_app", createdAt: T0, messageIds: ["m1"] }],
      new Set<string>(),
      new Map([["s1", T1]]),
    );
    assert.equal(row!.read, false);
  });

  it("is read once any of the letter's messages has been read", () => {
    // One letter, two guardians, two messages; either parent reading counts,
    // matching the old "any linked guardian" semantics.
    const [row] = letterReadState(
      [{ studentId: "s1", channel: "in_app", createdAt: T0, messageIds: ["m1", "m2"] }],
      new Set(["m2"]),
      new Map(),
    );
    assert.equal(row!.read, true);
  });

  it("falls back to the thread-level answer for a letter logged before messages were recorded", () => {
    const rows = letterReadState(
      [
        { studentId: "s1", channel: "in_app", createdAt: T0, messageIds: null },
        { studentId: "s2", channel: "in_app", createdAt: T1, messageIds: [] },
      ],
      new Set<string>(),
      new Map([["s1", T1], ["s2", T0]]),
    );
    assert.equal(rows[0]!.read, true, "opened after the letter");
    assert.equal(rows[1]!.read, false, "opened before the letter");
  });

  it("keeps every other field of the row", () => {
    const [row] = letterReadState(
      [{ studentId: "s1", channel: "in_app", createdAt: T0, messageIds: ["m1"], kind: "praise" }],
      new Set(["m1"]),
      new Map(),
    );
    assert.equal(row!.kind, "praise");
    assert.equal(row!.studentId, "s1");
  });
});
