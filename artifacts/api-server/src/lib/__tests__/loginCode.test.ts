/**
 * What this guards: the personal login code a parent or student gets when they
 * sign up with a teacher's code and no email.
 *
 * It is the only credential such an account has, so the properties that matter
 * are the ones a typo or a lazy refactor would quietly weaken: long enough that
 * guessing is hopeless (the teacher's 6-character code is NOT — about 887M
 * possibilities against thousands of live codes), readable off a screen, and
 * never stored as typed.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  generateLoginCode,
  hashLoginCode,
  LOGIN_CODE_LENGTH,
  normalizeLoginCode,
} from "../loginCode.ts";
import { SHARE_CODE_ALPHABET } from "../shareCodeAlphabet.ts";

describe("generateLoginCode", () => {
  it("is three dash-separated groups of four, from the unambiguous alphabet", () => {
    const code = generateLoginCode();
    assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    for (const c of code.replaceAll("-", "")) assert.ok(SHARE_CODE_ALPHABET.includes(c), `${c} outside alphabet`);
  });

  it("carries far more entropy than the teacher's 6-character code", () => {
    assert.equal(LOGIN_CODE_LENGTH, 12);
    // 31^12 ≈ 7.9e17; a 6-character code is 31^6 ≈ 8.9e8.
    assert.ok(Math.pow(SHARE_CODE_ALPHABET.length, LOGIN_CODE_LENGTH) > 1e17);
  });

  it("does not repeat", () => {
    const seen = new Set(Array.from({ length: 500 }, generateLoginCode));
    assert.equal(seen.size, 500);
  });
});

describe("normalizeLoginCode", () => {
  it("accepts what a person types: lower case, spaces, dashes or none", () => {
    const want = "ABCD2345EFGH";
    assert.equal(normalizeLoginCode("abcd-2345-efgh"), want);
    assert.equal(normalizeLoginCode(" ABCD 2345 EFGH "), want);
    assert.equal(normalizeLoginCode("abcd2345efgh"), want);
  });

  it("refuses anything that is not exactly a login code", () => {
    assert.equal(normalizeLoginCode("ABCD-2345"), null); // a teacher-length code is not a login code
    assert.equal(normalizeLoginCode("ABCD-2345-EFGH-JKMN"), null);
    assert.equal(normalizeLoginCode(""), null);
    assert.equal(normalizeLoginCode(undefined), null);
    assert.equal(normalizeLoginCode(12345678), null);
    assert.equal(normalizeLoginCode({ code: "ABCD-2345-EFGH" }), null);
  });

  it("drops characters outside the alphabet instead of guessing an intent", () => {
    // O and 0 and I and 1 are not in the alphabet; mapping them would invent a code.
    assert.equal(normalizeLoginCode("ABCD-2345-EFG0"), null);
  });
});

describe("hashLoginCode", () => {
  it("is the same for every spelling of one code", () => {
    assert.equal(hashLoginCode("abcd-2345-efgh"), hashLoginCode("ABCD2345EFGH"));
  });

  it("is a sha256 hex digest, never the code", () => {
    const h = hashLoginCode("ABCD-2345-EFGH")!;
    assert.match(h, /^[0-9a-f]{64}$/);
    assert.ok(!h.toLowerCase().includes("abcd2345"));
  });

  it("differs between codes", () => {
    assert.notEqual(hashLoginCode("ABCD-2345-EFGH"), hashLoginCode("ABCD-2345-EFGJ"));
  });

  it("cannot hash something that is not a code", () => {
    assert.equal(hashLoginCode("nope"), null);
  });
});
