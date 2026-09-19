/**
 * What this guards: PATCH /auth/users/profile trusts the client for which
 * grade/subject ids a teacher picked. Without filtering against the real
 * catalog, a stale client (or a hand-crafted request) could write an id that
 * no longer exists, and `needsTeacherSetup` on the client would then read a
 * non-empty-but-meaningless array as "already set up".
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { sanitizeCatalogIds, sanitizeTeachingAssignments } from "../catalogIds.ts";

const VALID = new Set(["grade-9", "grade-10", "mathematics"]);
const VALID_GRADES = new Set(["grade-9", "grade-10"]);
const VALID_SUBJECTS = new Set(["mathematics", "science"]);

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

describe("sanitizeTeachingAssignments", () => {
  it("keeps a well-formed grade/subjects pair", () => {
    assert.deepEqual(
      sanitizeTeachingAssignments([{ gradeId: "grade-9", subjectIds: ["mathematics"] }], VALID_GRADES, VALID_SUBJECTS),
      [{ gradeId: "grade-9", subjectIds: ["mathematics"] }],
    );
  });

  it("drops an entry whose gradeId isn't in the catalog", () => {
    assert.deepEqual(
      sanitizeTeachingAssignments([{ gradeId: "grade-99", subjectIds: ["mathematics"] }], VALID_GRADES, VALID_SUBJECTS),
      [],
    );
  });

  it("drops an entry left with no valid subjects — not a real assignment", () => {
    assert.deepEqual(
      sanitizeTeachingAssignments([{ gradeId: "grade-9", subjectIds: ["not-a-subject"] }], VALID_GRADES, VALID_SUBJECTS),
      [],
    );
    assert.deepEqual(
      sanitizeTeachingAssignments([{ gradeId: "grade-9", subjectIds: [] }], VALID_GRADES, VALID_SUBJECTS),
      [],
    );
  });

  it("merges two entries for the same grade instead of keeping duplicates", () => {
    assert.deepEqual(
      sanitizeTeachingAssignments(
        [
          { gradeId: "grade-9", subjectIds: ["mathematics"] },
          { gradeId: "grade-9", subjectIds: ["science"] },
        ],
        VALID_GRADES,
        VALID_SUBJECTS,
      ),
      [{ gradeId: "grade-9", subjectIds: ["mathematics", "science"] }],
    );
  });

  it("keeps grades scoped to their own subjects, not the union across grades", () => {
    assert.deepEqual(
      sanitizeTeachingAssignments(
        [
          { gradeId: "grade-9", subjectIds: ["mathematics"] },
          { gradeId: "grade-10", subjectIds: ["science"] },
        ],
        VALID_GRADES,
        VALID_SUBJECTS,
      ),
      [
        { gradeId: "grade-9", subjectIds: ["mathematics"] },
        { gradeId: "grade-10", subjectIds: ["science"] },
      ],
    );
  });

  it("ignores malformed entries without throwing", () => {
    assert.deepEqual(
      sanitizeTeachingAssignments([null, 42, "grade-9", { gradeId: 5, subjectIds: ["mathematics"] }], VALID_GRADES, VALID_SUBJECTS),
      [],
    );
  });

  it("returns undefined for anything that isn't an array", () => {
    assert.equal(sanitizeTeachingAssignments(undefined, VALID_GRADES, VALID_SUBJECTS), undefined);
    assert.equal(sanitizeTeachingAssignments(null, VALID_GRADES, VALID_SUBJECTS), undefined);
  });
});
