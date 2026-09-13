/**
 * What this guards: the signup verification code must be a real 6-digit
 * string every time (including when the CSPRNG rolls a value under 100000,
 * which needs the left-pad or it silently produces a 4- or 5-digit code)
 * and the stored hash must never equal the code it hashes.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { generateVerificationCode, hashVerificationCode } from "../emailVerification.ts";

describe("generateVerificationCode", () => {
  it("always returns exactly 6 digits", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateVerificationCode();
      assert.match(code, /^\d{6}$/);
    }
  });
});

describe("hashVerificationCode", () => {
  it("is deterministic for the same code", () => {
    assert.equal(hashVerificationCode("123456"), hashVerificationCode("123456"));
  });

  it("differs for different codes", () => {
    assert.notEqual(hashVerificationCode("123456"), hashVerificationCode("654321"));
  });

  it("never equals the plaintext code", () => {
    assert.notEqual(hashVerificationCode("123456"), "123456");
  });
});
