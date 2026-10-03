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

import { termsAcceptance } from "../termsAcceptance.ts";

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
