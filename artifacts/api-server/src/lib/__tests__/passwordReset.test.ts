/**
 * What these guard: the reset code is stored as a hash in a table whose
 * `token_hash` column is UNIQUE, and the code itself is only 6 digits. Both
 * facts are load-bearing, and neither is visible from the route that uses them.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { generateResetCode, hashResetCode, RESET_CODE_TTL_MS } from "../passwordReset.ts";
import { VERIFICATION_CODE_TTL_MS } from "../emailVerification.ts";

describe("generateResetCode", () => {
  it("is always six digits, including when the draw is small", () => {
    for (let i = 0; i < 200; i++) {
      assert.match(generateResetCode(), /^\d{6}$/);
    }
  });
});

describe("hashResetCode", () => {
  it("never returns the code itself", () => {
    const hash = hashResetCode("user-1", "123456");
    assert.equal(hash.includes("123456"), false);
    assert.match(hash, /^[0-9a-f]{64}$/);
  });

  it("is stable for the same user and code", () => {
    assert.equal(hashResetCode("user-1", "123456"), hashResetCode("user-1", "123456"));
  });

  /**
   * The one that matters. Without user scoping, two people holding the same
   * 6-digit code collide on a UNIQUE column — the second insert fails, and
   * whoever asked second is told reset is broken.
   */
  it("gives two users different hashes for the same code", () => {
    assert.notEqual(hashResetCode("user-1", "123456"), hashResetCode("user-2", "123456"));
  });

  it("will not validate a code against the wrong account", () => {
    const issuedTo = hashResetCode("user-1", "123456");
    assert.notEqual(hashResetCode("attacker", "123456"), issuedTo);
  });
});

describe("RESET_CODE_TTL_MS", () => {
  it("matches the verification code's lifetime — the two emails age alike", () => {
    assert.equal(RESET_CODE_TTL_MS, VERIFICATION_CODE_TTL_MS);
  });
});
