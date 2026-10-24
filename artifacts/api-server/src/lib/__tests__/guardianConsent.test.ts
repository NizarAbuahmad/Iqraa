// artifacts/api-server/src/lib/__tests__/guardianConsent.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  CONSENT_TTL_MS,
  DAY_MS,
  GUARDIAN_LIMITS,
  generateConsentToken,
  hashConsentToken,
  limitReached,
  looksLikeConsentToken,
  maskEmail,
  normalizeParentEmail,
} from "../guardianConsent.ts";

describe("normalizeParentEmail", () => {
  it("trims and lower-cases a valid address", () => {
    assert.deepEqual(normalizeParentEmail("  Parent@Example.COM ", "kid@example.test"), { ok: true, email: "parent@example.com" });
  });
  it("is required: undefined, null, empty and blank are all parent_email_required", () => {
    for (const raw of [undefined, null, "", "   "]) {
      const r = normalizeParentEmail(raw, "kid@example.test");
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.code, "parent_email_required");
    }
  });
  it("refuses something that is not an address, including a non-string", () => {
    for (const raw of ["not-an-email", "a@b", 42, ["p@example.com"], { a: 1 }]) {
      const r = normalizeParentEmail(raw, "kid@example.test");
      assert.equal(r.ok, false, JSON.stringify(raw));
      if (!r.ok) assert.equal(r.code, "parent_email_invalid");
    }
  });
  it("refuses the student's own address, however it is cased or padded", () => {
    const r = normalizeParentEmail(" KID@example.test ", "kid@example.test");
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.code, "parent_email_is_own");
      assert.equal(r.status, 400);
    }
  });
  it("accepts any address when the student has none yet", () => {
    assert.equal(normalizeParentEmail("p@example.com", null).ok, true);
  });
});

describe("consent token", () => {
  it("is 43 url-safe characters, different every time, and recognised by looksLikeConsentToken", () => {
    const a = generateConsentToken();
    const b = generateConsentToken();
    assert.match(a, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(a, b);
    assert.equal(looksLikeConsentToken(a), true);
  });
  it("rejects anything that is not that shape before it reaches the database", () => {
    for (const t of ["", "abc", "a".repeat(42), "a".repeat(44), `${"a".repeat(42)}!`, undefined, null, 5]) {
      assert.equal(looksLikeConsentToken(t), false, String(t));
    }
  });
  it("hashes to a stable sha256 hex that is not the token", () => {
    const t = generateConsentToken();
    assert.equal(hashConsentToken(t), hashConsentToken(t));
    assert.match(hashConsentToken(t), /^[0-9a-f]{64}$/);
    assert.notEqual(hashConsentToken(t), t);
    assert.notEqual(hashConsentToken(t), hashConsentToken(generateConsentToken()));
  });
});

describe("maskEmail", () => {
  it("keeps two characters of a long local part and the whole domain", () => {
    assert.equal(maskEmail("parent@gmail.com"), "pa***@gmail.com");
  });
  it("keeps one character of a short local part", () => {
    assert.equal(maskEmail("ab@x.com"), "a***@x.com");
    assert.equal(maskEmail("a@x.com"), "a***@x.com");
  });
});

describe("limits and constants", () => {
  it("has the numbers the spec states", () => {
    assert.equal(GUARDIAN_LIMITS.perStudentPerDay, 3);
    assert.equal(GUARDIAN_LIMITS.perParentPerDay, 5);
    assert.equal(CONSENT_TTL_MS, 7 * 24 * 60 * 60 * 1000);
    assert.equal(DAY_MS, 24 * 60 * 60 * 1000);
  });
  it("limitReached is true at the cap, not above it", () => {
    assert.equal(limitReached(2, 3), false);
    assert.equal(limitReached(3, 3), true);
    assert.equal(limitReached(4, 3), true);
  });
});
