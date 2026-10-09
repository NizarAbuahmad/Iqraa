/**
 * What this guards: deleting a Google-only account must take a Google sign-in
 * made moments ago by that account's own Google user — not a stolen access
 * token, not another Google user, not an old ID token.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkGoogleReauth, GOOGLE_REAUTH_MAX_AGE_S } from "../googleReauth.ts";

const now = Date.UTC(2026, 9, 9, 12, 0, 0);
const nowS = now / 1000;

describe("checkGoogleReauth", () => {
  it("accepts the linked Google user signing in just now", () => {
    assert.equal(checkGoogleReauth({ sub: "g-1", iat: nowS - 10 }, "g-1", now), "ok");
  });

  it("rejects a different Google user", () => {
    assert.equal(checkGoogleReauth({ sub: "g-2", iat: nowS }, "g-1", now), "wrong_account");
  });

  it("rejects when the account has no linked Google id", () => {
    assert.equal(checkGoogleReauth({ sub: "g-1", iat: nowS }, null, now), "wrong_account");
  });

  it("rejects a missing payload or sub", () => {
    assert.equal(checkGoogleReauth(undefined, "g-1", now), "wrong_account");
    assert.equal(checkGoogleReauth({ iat: nowS }, "g-1", now), "wrong_account");
  });

  it("rejects a token older than the window", () => {
    assert.equal(checkGoogleReauth({ sub: "g-1", iat: nowS - GOOGLE_REAUTH_MAX_AGE_S - 1 }, "g-1", now), "stale");
    assert.equal(checkGoogleReauth({ sub: "g-1", iat: nowS - GOOGLE_REAUTH_MAX_AGE_S }, "g-1", now), "ok");
  });

  it("rejects a token without iat or far in the future", () => {
    assert.equal(checkGoogleReauth({ sub: "g-1" }, "g-1", now), "stale");
    assert.equal(checkGoogleReauth({ sub: "g-1", iat: nowS + 3600 }, "g-1", now), "stale");
    assert.equal(checkGoogleReauth({ sub: "g-1", iat: nowS + 30 }, "g-1", now), "ok");
  });
});
