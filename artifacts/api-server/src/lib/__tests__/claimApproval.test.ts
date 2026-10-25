/**
 * What this guards: which claims wait for the teacher. Only a STUDENT who
 * picked a name off a CLASS code is held — that is the one path where nothing
 * but a shared string proves who is asking. A per-student code was handed to
 * that child by the teacher, and a parent can only use the per-student code
 * (redeemRoleCheck), so neither is held; holding them would make the teacher
 * approve people they already chose.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_PENDING_CLAIMS_PER_STUDENT,
  claimNeedsApproval,
  pendingLimitReached,
} from "../claimDecision.ts";

const ok = (relation: "self" | "guardian", viaClassCode: boolean) =>
  ({ ok: true as const, studentId: "s", relation, viaClassCode });

describe("claimNeedsApproval", () => {
  it("holds a student's pick off a class code", () => {
    assert.equal(claimNeedsApproval(ok("self", true)), true);
  });

  it("does not hold a student who has the code the teacher wrote for them", () => {
    assert.equal(claimNeedsApproval(ok("self", false)), false);
  });

  it("never holds a parent, whichever code was used", () => {
    assert.equal(claimNeedsApproval(ok("guardian", true)), false);
    assert.equal(claimNeedsApproval(ok("guardian", false)), false);
  });
});

describe("pendingLimitReached", () => {
  it("allows requests up to the cap and refuses the next one", () => {
    assert.equal(MAX_PENDING_CLAIMS_PER_STUDENT, 5);
    assert.equal(pendingLimitReached(0), false);
    assert.equal(pendingLimitReached(4), false);
    assert.equal(pendingLimitReached(5), true);
    assert.equal(pendingLimitReached(9), true);
  });
});
