/**
 * What this guards: PATCH /auth/users/profile trusts the client for which
 * grade/subject ids a teacher picked. Without filtering against the real
 * catalog, a stale client (or a hand-crafted request) could write an id that
 * no longer exists, and `needsTeacherSetup` on the client would then read a
 * non-empty-but-meaningless array as "already set up".
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { sanitizeCatalogIds } from "../catalogIds.ts";

const VALID = new Set(["grade-9", "grade-10", "mathematics"]);

describe("sanitizeCatalogIds", () => {
  it("keeps only ids present in the catalog", () => {
    assert.deepEqual(sanitizeCatalogIds(["grade-9", "grade-11", "mathematics"], VALID), ["grade-9", "mathematics"]);
  });

  it("dedupes", () => {
    assert.deepEqual(sanitizeCatalogIds(["grade-9", "grade-9"], VALID), ["grade-9"]);
  });

  it("drops non-string entries without throwing", () => {
    assert.deepEqual(sanitizeCatalogIds(["grade-9", 42, null, { id: "grade-10" }], VALID), ["grade-9"]);
  });

  it("returns an empty array for an empty selection, distinct from 'not sent'", () => {
    assert.deepEqual(sanitizeCatalogIds([], VALID), []);
  });

  it("returns undefined for anything that isn't an array, so the caller can leave the column untouched", () => {
    assert.equal(sanitizeCatalogIds(undefined, VALID), undefined);
    assert.equal(sanitizeCatalogIds(null, VALID), undefined);
    assert.equal(sanitizeCatalogIds("grade-9", VALID), undefined);
  });
});
