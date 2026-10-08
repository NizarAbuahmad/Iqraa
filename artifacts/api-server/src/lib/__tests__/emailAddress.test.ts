/**
 * What this guards: signup used to accept anything containing an "@", so
 * «info@zarya.gate@gmail.com» created an account, answered 201 "check your
 * email", and the verification mail could never be delivered — the teacher sat
 * on the code screen with nothing coming. The address has to be one a mail
 * provider can actually deliver to before an account is created for it.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { isValidEmailAddress } from "../emailAddress.ts";

describe("isValidEmailAddress", () => {
  it("accepts ordinary addresses, including plus-aliases and dotted names", () => {
    for (const ok of [
      "teacher@school.edu.jo",
      "nizar.abuahmad+otp-test@gmail.com",
      "first_last-1@sub.example.org",
      "A@B.co",
    ]) {
      assert.equal(isValidEmailAddress(ok), true, ok);
    }
  });

  it("rejects an address with more than one @ — the one that never got a code", () => {
    assert.equal(isValidEmailAddress("info@zarya.gate@gmail.com"), false);
  });

  it("rejects a missing local part, domain, or dot in the domain", () => {
    for (const bad of ["@gmail.com", "info@", "info@gmail", "info@.com", "info@gmail.", "info"]) {
      assert.equal(isValidEmailAddress(bad), false, bad);
    }
  });

  it("rejects whitespace inside the address", () => {
    for (const bad of ["in fo@gmail.com", "info@gm ail.com", "in\nfo@gmail.com"]) {
      assert.equal(isValidEmailAddress(bad), false, JSON.stringify(bad));
    }
  });

  it("rejects dot misuse in the local part and the domain", () => {
    for (const bad of [".info@gmail.com", "info.@gmail.com", "in..fo@gmail.com", "info@gmail..com"]) {
      assert.equal(isValidEmailAddress(bad), false, bad);
    }
  });

  it("rejects a domain label that starts or ends with a hyphen, or a one-letter TLD", () => {
    for (const bad of ["info@-gmail.com", "info@gmail-.com", "info@gmail.c", "info@gmail.123"]) {
      assert.equal(isValidEmailAddress(bad), false, bad);
    }
  });

  it("rejects Arabic-script addresses instead of letting the mail provider fail on them", () => {
    assert.equal(isValidEmailAddress("معلم@gmail.com"), false);
  });

  it("rejects overlong parts", () => {
    assert.equal(isValidEmailAddress(`${"a".repeat(65)}@gmail.com`), false);
    assert.equal(isValidEmailAddress(`a@${"b".repeat(64)}.com`), false);
    assert.equal(isValidEmailAddress(`a@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(63)}.${"e".repeat(63)}.com`), false);
  });

  it("rejects values that are not strings", () => {
    for (const bad of [undefined, null, 42, {}, ["a@b.co"]]) {
      assert.equal(isValidEmailAddress(bad), false, String(bad));
    }
  });

  it("is judged on the trimmed value, since callers trim before storing", () => {
    assert.equal(isValidEmailAddress("  teacher@school.edu.jo  "), true);
  });
});
