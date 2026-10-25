/**
 * What this guards: a student may sign up with an email and no teacher's code
 * (since 2026-10-23), so nobody vouches for them the way a code does. The
 * register screen asks them to confirm they are an adult or have a guardian's
 * agreement, and the server refuses a new student account that did not.
 * Teachers and parents (who still arrive by a code) are not asked.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { ageConfirmation } from "../ageConfirmation.ts";

const NOW = new Date("2026-10-23T10:00:00Z");

describe("ageConfirmation", () => {
  it("refuses a new student who did not confirm, with a code the screen can translate", () => {
    const got = ageConfirmation({ acceptedTerms: true }, "student", NOW);
    assert.equal(got.ok, false);
    assert.equal(got.ok === false && got.status, 400);
    assert.equal(got.ok === false && got.code, "age_confirmation_required");
  });

  it("accepts only the literal true — a string or a 1 is not a consent", () => {
    for (const bad of ["true", 1, "yes", null, undefined]) {
      assert.equal(ageConfirmation({ ageConfirmed: bad }, "student", NOW).ok, false);
    }
  });

  it("records when a student confirmed", () => {
    const got = ageConfirmation({ ageConfirmed: true }, "student", NOW);
    assert.deepEqual(got, { ok: true, guardianConfirmedAt: NOW });
  });

  it("does not ask a teacher or a parent, and records nothing for them", () => {
    assert.deepEqual(ageConfirmation({}, "teacher", NOW), { ok: true, guardianConfirmedAt: null });
    assert.deepEqual(ageConfirmation({}, "parent", NOW), { ok: true, guardianConfirmedAt: null });
  });

  it("copes with a body that is not an object", () => {
    assert.equal(ageConfirmation(undefined, "student", NOW).ok, false);
    assert.equal(ageConfirmation("x", "student", NOW).ok, false);
    assert.equal(ageConfirmation(undefined, "teacher", NOW).ok, true);
  });
});
