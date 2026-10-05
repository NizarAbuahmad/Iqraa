/**
 * What a new account must send to say it accepted the terms.
 *
 * The register screen had a terms checkbox that gated only the password
 * form: «متابعة عبر Google» ignored it, and the server stored nothing either
 * way. For accounts that include minors', "the box was probably ticked" is
 * not a record. These pin the rule the server now enforces.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { isBehindTerms, termsAcceptance, termsReacceptance, termsVersionRank } from "../termsAcceptance.ts";

const NOW = new Date("2026-10-03T12:00:00Z");

describe("termsAcceptance", () => {
  it("records acceptance with the version the client showed", () => {
    const r = termsAcceptance({ acceptedTerms: true, termsVersion: "2026-09-06" }, NOW);
    assert.deepEqual(r, { ok: true, termsAcceptedAt: NOW, termsVersion: "2026-09-06" });
  });

  it("refuses an account that did not accept", () => {
    for (const body of [{}, { acceptedTerms: false }, { acceptedTerms: "true" }, { acceptedTerms: 1 }, null]) {
      const r = termsAcceptance(body, NOW);
      assert.equal(r.ok, false, JSON.stringify(body));
      assert.equal((r as { code: string }).code, "terms_required");
      assert.equal((r as { status: number }).status, 400);
    }
  });

  it("never stores a version string it cannot vouch for", () => {
    const missing = termsAcceptance({ acceptedTerms: true }, NOW);
    assert.equal(missing.ok && missing.termsVersion, "unspecified");
    const junk = termsAcceptance({ acceptedTerms: true, termsVersion: "<script>" }, NOW);
    assert.equal(junk.ok && junk.termsVersion, "unspecified");
    const long = termsAcceptance({ acceptedTerms: true, termsVersion: "2026-09-06." + "x".repeat(100) }, NOW);
    assert.equal(long.ok && long.termsVersion, "unspecified");
  });

  it("accepts a suffixed version for a same-day revision", () => {
    const r = termsAcceptance({ acceptedTerms: true, termsVersion: "2026-09-06.v2" }, NOW);
    assert.equal(r.ok && r.termsVersion, "2026-09-06.v2");
  });
});

describe("isBehindTerms", () => {
  it("is behind when nothing, or nothing readable, was ever accepted", () => {
    // "" is every account from before 2026-10-03; "unspecified" is a sign-up
    // that sent a malformed version. Neither names a wording anyone saw.
    for (const stored of ["", "unspecified", null, undefined, "not a date"]) {
      assert.equal(isBehindTerms(stored, "2026-09-06"), true, String(stored));
    }
  });

  it("is behind an older version, not the current or a newer one", () => {
    assert.equal(isBehindTerms("2026-09-06", "2026-10-05"), true);
    assert.equal(isBehindTerms("2026-10-05", "2026-10-05"), false);
    assert.equal(isBehindTerms("2026-10-05.b", "2026-10-05"), false);
    assert.equal(isBehindTerms("2026-11-01", "2026-10-05"), false);
  });

  it("treats a same-day revision as newer than its bare date", () => {
    assert.equal(isBehindTerms("2026-10-05", "2026-10-05.b"), true);
  });

  it("never lets 'unspecified' outrank a real date", () => {
    // Plain string comparison would put "unspecified" after every date.
    assert.equal(termsVersionRank("unspecified"), "");
  });
});

describe("termsReacceptance", () => {
  const LATER = new Date("2026-10-05T09:00:00Z");

  it("records a newer version with the moment it was accepted", () => {
    const r = termsReacceptance({ termsVersion: "2026-10-05" }, "2026-09-06", LATER);
    assert.deepEqual(r, { ok: true, changed: true, termsAcceptedAt: LATER, termsVersion: "2026-10-05" });
  });

  it("records an account that never accepted anything", () => {
    for (const stored of ["", "unspecified", null]) {
      const r = termsReacceptance({ termsVersion: "2026-09-06" }, stored, LATER);
      assert.equal(r.ok && r.changed, true, String(stored));
    }
  });

  it("keeps the first timestamp when the same version is sent twice", () => {
    assert.deepEqual(termsReacceptance({ termsVersion: "2026-10-05" }, "2026-10-05", LATER), { ok: true, changed: false });
  });

  it("does not move the record backwards for an outdated client", () => {
    assert.deepEqual(termsReacceptance({ termsVersion: "2026-09-06" }, "2026-10-05", LATER), { ok: true, changed: false });
  });

  it("refuses anything that is not a date-shaped version", () => {
    for (const body of [undefined, null, {}, { termsVersion: 7 }, { termsVersion: "" }, { termsVersion: "latest" }, { termsVersion: "2026-10-05; drop" }]) {
      const r = termsReacceptance(body, "", LATER);
      assert.equal(r.ok, false, JSON.stringify(body));
      if (!r.ok) assert.equal(r.code, "invalid_terms_version");
    }
  });

  it("refuses a wording that does not exist yet, but allows timezone slack", () => {
    assert.equal(termsReacceptance({ termsVersion: "2099-01-01" }, "", LATER).ok, false);
    assert.equal(termsReacceptance({ termsVersion: "2026-10-06" }, "", LATER).ok, true);
    assert.equal(termsReacceptance({ termsVersion: "2026-10-07" }, "", LATER).ok, false);
  });
});
