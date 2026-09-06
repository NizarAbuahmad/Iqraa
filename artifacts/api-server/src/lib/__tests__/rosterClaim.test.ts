/**
 * The claim-code resolver's two guards that need no database.
 *
 * This flow shipped with zero tests. The two things asserted here are the two
 * that were actually wrong: a code a human typed was rejected because nobody
 * normalised it, and "is this code still live" was written inline in one place
 * and nowhere else, so the teacher's screen could display a code the resolver
 * would refuse.
 *
 * The happy path needs `@workspace/db` and stays a manual check, as the roster
 * consent gate's does.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { claimCodeIsLive, claimCodeLookupKey } from "../claimCode.ts";

describe("claimCodeIsLive", () => {
  it("treats a missing expiry as not live", () => {
    // A row can carry a code with a null expiry; that is not redeemable.
    assert.equal(claimCodeIsLive(null), false);
    assert.equal(claimCodeIsLive(undefined), false);
  });

  it("distinguishes past from future", () => {
    assert.equal(claimCodeIsLive(new Date(Date.now() - 1000)), false);
    assert.equal(claimCodeIsLive(new Date(Date.now() + 60_000)), true);
  });
});

describe("claimCodeLookupKey", () => {
  it("accepts what a parent actually types", () => {
    // The reported failure: a paste arrives lower case, with the dash people
    // add because it looks like a code, and a trailing space. Compared
    // verbatim — as both call sites used to — every one of these missed and
    // the parent was told the code was invalid or expired.
    for (const typed of ["abc234", "ABC-234", " abc 234 ", "abc - 234"]) {
      assert.equal(claimCodeLookupKey(typed), "ABC234", `should resolve ${JSON.stringify(typed)}`);
    }
  });

  it("returns null when nothing usable is left, so the caller can bail before querying", () => {
    for (const junk of ["", "   ", "---", "  -- ", null, undefined, 42]) {
      assert.equal(claimCodeLookupKey(junk), null);
    }
  });
});
