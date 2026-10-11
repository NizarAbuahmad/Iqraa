/**
 * Who an evaluation is for. A group check (support groups, 2026-10-09) is
 * for exactly the students assigned to it; everything else is for the class,
 * as before. Holding an attempt always keeps an exam visible.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  audienceFor, audienceRequestDecision, classChangeAllowed, examVisibleTo, inAudience, MAX_AUDIENCE,
} from "../audience.ts";

describe("audienceFor / inAudience", () => {
  it("is the whole class when nobody is assigned", () => {
    assert.deepEqual(audienceFor(undefined), { kind: "class" });
    assert.deepEqual(audienceFor([]), { kind: "class" });
    assert.equal(inAudience(audienceFor([]), "anyone"), true);
  });
  it("is exactly the assigned students otherwise", () => {
    const a = audienceFor(["s1", "s2"]);
    assert.equal(a.kind, "students");
    assert.equal(inAudience(a, "s1"), true);
    assert.equal(inAudience(a, "s3"), false);
  });
});

describe("examVisibleTo", () => {
  it("shows a class exam to any member and a group check only to its members", () => {
    assert.equal(examVisibleTo(undefined, ["s9"], false), true);
    assert.equal(examVisibleTo(["s1"], ["s1"], false), true);
    assert.equal(examVisibleTo(["s1"], ["s9"], false), false);
  });
  it("matches any of several linked roster rows", () => {
    assert.equal(examVisibleTo(["s2"], ["s1", "s2"], false), true);
  });
  it("keeps an exam the student already holds an attempt on", () => {
    assert.equal(examVisibleTo(["s1"], ["s9"], true), true);
  });
});

describe("audienceRequestDecision", () => {
  const base = { status: "draft", classGroupId: "c1", memberIds: new Set(["s1", "s2"]) };
  it("accepts members of a draft attached to a class", () => {
    assert.deepEqual(audienceRequestDecision({ ...base, studentIds: ["s1", "s2"] }), { ok: true, studentIds: ["s1", "s2"] });
  });
  it("refuses an empty, malformed or duplicated list", () => {
    for (const studentIds of [[], undefined, "s1", [1], ["s1", "s1"], ["s1", " "]]) {
      const d = audienceRequestDecision({ ...base, studentIds });
      assert.equal(d.ok, false);
      if (!d.ok) assert.equal(d.status, 400);
    }
  });
  it("refuses once published, and without a class", () => {
    const published = audienceRequestDecision({ ...base, status: "published", studentIds: ["s1"] });
    assert.equal(published.ok, false);
    if (!published.ok) { assert.equal(published.status, 409); assert.equal(published.code, "audience_locked"); }
    const noClass = audienceRequestDecision({ ...base, classGroupId: null, studentIds: ["s1"] });
    assert.equal(noClass.ok, false);
    if (!noClass.ok) { assert.equal(noClass.status, 409); assert.equal(noClass.code, "audience_no_class"); }
  });
  it("refuses a student who is not a live member of the class", () => {
    const d = audienceRequestDecision({ ...base, studentIds: ["s1", "s3"] });
    assert.equal(d.ok, false);
    if (!d.ok) { assert.equal(d.status, 400); assert.equal(d.code, "audience_not_member"); }
  });
});

describe("audienceRequestDecision — size", () => {
  it("refuses more than MAX_AUDIENCE ids with 400 audience_too_large", () => {
    assert.equal(MAX_AUDIENCE, 200);
    const ids = Array.from({ length: MAX_AUDIENCE + 1 }, (_, i) => `s${i}`);
    const d = audienceRequestDecision({
      status: "draft", classGroupId: "c1", memberIds: new Set(ids), studentIds: ids,
    });
    assert.equal(d.ok, false);
    if (!d.ok) { assert.equal(d.status, 400); assert.equal(d.code, "audience_too_large"); }
  });
  it("accepts exactly MAX_AUDIENCE ids", () => {
    const ids = Array.from({ length: MAX_AUDIENCE }, (_, i) => `s${i}`);
    const d = audienceRequestDecision({
      status: "draft", classGroupId: "c1", memberIds: new Set(ids), studentIds: ids,
    });
    assert.equal(d.ok, true);
  });
});

describe("classChangeAllowed", () => {
  const members = new Set(["s1", "s2", "s3"]);
  it("allows any change for a class-wide check (nobody assigned)", () => {
    assert.equal(classChangeAllowed([], new Set(), "c2", "c1"), true);
  });
  it("allows detaching a group check", () => {
    assert.equal(classChangeAllowed(["s1"], new Set(), null, "c1"), true);
  });
  it("allows the class it is already in", () => {
    assert.equal(classChangeAllowed(["s1"], new Set(), "c1", "c1"), true);
  });
  it("allows a class that holds every assigned student", () => {
    assert.equal(classChangeAllowed(["s1", "s2"], members, "c2", "c1"), true);
    assert.equal(classChangeAllowed(["s1", "s2"], members, "c2", null), true);
  });
  it("refuses a class missing any assigned student", () => {
    assert.equal(classChangeAllowed(["s1", "s9"], members, "c2", "c1"), false);
    assert.equal(classChangeAllowed(["s1"], new Set(), "c2", "c1"), false);
  });
});
