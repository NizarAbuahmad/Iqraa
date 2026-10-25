/**
 * What this guards: school membership decides who may read a teacher's exam
 * dates, and it is set by hand from the admin users screen. `schoolId: null`
 * must clear (the `!== undefined` rule again), and an absent or malformed id
 * must be refused rather than treated as a clear — a request that forgot the
 * field silently evicting a teacher from their school would be the worst way
 * for this to fail.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { MAX_SCHOOL_NAME, parseSchoolAssignment, parseSchoolIdFilter, parseSchoolInput } from "../adminSchools.ts";

function rejects(fn: () => unknown): string {
  try {
    fn();
  } catch (msg) {
    return String(msg);
  }
  assert.fail("expected the call to throw");
}

const ID = "3f2b8d3e-6a41-4c55-9d0e-1a2b3c4d5e6f";

describe("parseSchoolInput", () => {
  it("trims and collapses whitespace in a name", () => {
    assert.deepEqual(parseSchoolInput({ name: "  مدرسة   الأمير  حسين " }), { name: "مدرسة الأمير حسين" });
  });

  it("refuses a missing, blank or non-string name", () => {
    assert.match(rejects(() => parseSchoolInput({})), /name/);
    assert.match(rejects(() => parseSchoolInput({ name: "   " })), /name/);
    assert.match(rejects(() => parseSchoolInput({ name: 12 })), /name/);
    assert.match(rejects(() => parseSchoolInput(null)), /name/);
  });

  it("refuses a name past the limit", () => {
    assert.match(rejects(() => parseSchoolInput({ name: "a".repeat(MAX_SCHOOL_NAME + 1) })), /at most/);
    assert.equal(parseSchoolInput({ name: "a".repeat(MAX_SCHOOL_NAME) }).name.length, MAX_SCHOOL_NAME);
  });
});

describe("parseSchoolAssignment", () => {
  it("returns the school id", () => {
    assert.equal(parseSchoolAssignment({ schoolId: ID }), ID);
  });

  it("returns null on an explicit null, which removes the teacher from their school", () => {
    assert.equal(parseSchoolAssignment({ schoolId: null }), null);
  });

  it("refuses an absent schoolId rather than reading it as a removal", () => {
    assert.match(rejects(() => parseSchoolAssignment({})), /schoolId/);
    assert.match(rejects(() => parseSchoolAssignment(undefined)), /schoolId/);
  });

  it("refuses anything that is not a uuid", () => {
    assert.match(rejects(() => parseSchoolAssignment({ schoolId: "" })), /schoolId/);
    assert.match(rejects(() => parseSchoolAssignment({ schoolId: "school-1" })), /schoolId/);
    assert.match(rejects(() => parseSchoolAssignment({ schoolId: 7 })), /schoolId/);
  });
});

describe("parseSchoolIdFilter", () => {
  it("returns the id", () => {
    assert.equal(parseSchoolIdFilter(ID), ID);
  });

  it("means no filter when absent or empty", () => {
    assert.equal(parseSchoolIdFilter(undefined), undefined);
    assert.equal(parseSchoolIdFilter(""), undefined);
  });

  it("refuses a malformed id rather than listing every teacher", () => {
    assert.match(rejects(() => parseSchoolIdFilter("school-1")), /schoolId/);
    assert.match(rejects(() => parseSchoolIdFilter(["a", "b"])), /schoolId/);
    assert.match(rejects(() => parseSchoolIdFilter(7)), /schoolId/);
  });
});
