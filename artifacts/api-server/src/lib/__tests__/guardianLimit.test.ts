/**
 * What this guards: how many parent accounts one child can have.
 *
 * A per-student claim code is deliberately not single-use — a second guardian
 * is added with the same code on purpose. Before code-only sign-up that was
 * bounded by the cost of an email account per guardian; now anyone holding a
 * child's code can mint a guardian account for free, each one reading that
 * child's messages. The cap puts a ceiling on it. The teacher can unlink one to
 * make room.
 *
 * The count is of guardians OTHER than the caller: a parent re-sending a claim
 * they already made must not be refused for taking a seat they already hold.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { guardianLimitReached, MAX_GUARDIANS_PER_STUDENT } from "../guardianLimit.ts";

describe("guardianLimitReached", () => {
  it("allows a first, second and third other guardian", () => {
    for (const others of [0, 1, 2]) assert.equal(guardianLimitReached(others), false, `${others} others`);
  });

  it("allows exactly up to the cap, counting the caller", () => {
    // MAX - 1 others + the caller = MAX guardians: the last free seat.
    assert.equal(guardianLimitReached(MAX_GUARDIANS_PER_STUDENT - 1), false);
  });

  it("refuses once the others already fill every seat", () => {
    assert.equal(guardianLimitReached(MAX_GUARDIANS_PER_STUDENT), true);
    assert.equal(guardianLimitReached(MAX_GUARDIANS_PER_STUDENT + 3), true);
  });

  it("is generous enough for a real family: two parents and two more relatives", () => {
    assert.ok(MAX_GUARDIANS_PER_STUDENT >= 4);
  });

  it("is small enough to be a ceiling on abuse, not a formality", () => {
    assert.ok(MAX_GUARDIANS_PER_STUDENT <= 6);
  });
});
