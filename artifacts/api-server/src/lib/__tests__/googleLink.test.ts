/**
 * What this guards: the account-takeover path that `/auth/google` used to be.
 *
 * `/register` creates a row with `emailVerified: false`, a password the caller
 * chose, and no session — so pre-creating an account on someone else's address
 * is a single unauthenticated request, and it looks like nothing because
 * `/login` refuses the row. Google sign-in on that address later marks the row
 * verified, and at that moment the pre-creator's password starts working on an
 * account that belongs to someone else. No rate limit sees it; the two halves
 * are weeks apart.
 *
 * So the assertion that matters is the first one below: linking to an
 * unverified row clears `passwordHash`. It reads like a detail and it is the
 * whole fix.
 *
 * The opposite direction has to hold too — an already-verified account must
 * keep its password, or every teacher who signs in with Google once is
 * silently locked out of the password they still use.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { decideGoogleLink } from "../googleLink.ts";

describe("decideGoogleLink", () => {
  it("clears the password when linking to a row that never proved its address", () => {
    const decision = decideGoogleLink({ emailVerified: false }, "google-sub-1");

    // The takeover-closing line: a password nobody proved does not survive.
    assert.equal(decision.update.passwordHash, null);
    assert.ok("passwordHash" in decision.update);
    assert.equal(decision.update.emailVerified, true);
    assert.equal(decision.update.googleId, "google-sub-1");
    assert.equal(decision.revokeExistingCredentials, true);
  });

  it("leaves a verified account's password alone", () => {
    const decision = decideGoogleLink({ emailVerified: true }, "google-sub-2");

    // Absent, not null: `db.update().set()` writes every key it is given, so
    // an explicit `passwordHash: undefined` here would still be a column in
    // the statement. The key has to be missing.
    assert.equal("passwordHash" in decision.update, false);
    assert.equal(decision.update.emailVerified, true);
    assert.equal(decision.update.googleId, "google-sub-2");
    assert.equal(decision.revokeExistingCredentials, false);
  });

  it("treats a missing verification flag as unverified", () => {
    // The column is NOT NULL today. If that ever stops being true, the safe
    // reading of "no answer" is the one that distrusts the password.
    const decision = decideGoogleLink({ emailVerified: null }, "google-sub-3");

    assert.equal(decision.update.passwordHash, null);
    assert.equal(decision.revokeExistingCredentials, true);
  });
});
