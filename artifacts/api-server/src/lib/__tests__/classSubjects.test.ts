/**
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/classSubjects.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseSubjectIds, subjectColumns, withSubjectIds } from "../classSubjects.ts";

describe("parseSubjectIds", () => {
  it("trims, drops blanks, non-strings and duplicates", () => {
    assert.deepEqual(parseSubjectIds([" arabic ", "", 3, "arabic", "science"]), ["arabic", "science"]);
  });
  it("is undefined for a non-array", () => {
    assert.equal(parseSubjectIds("arabic"), undefined);
    assert.equal(parseSubjectIds(undefined), undefined);
  });
  it("is bounded", () => {
    assert.equal(parseSubjectIds(Array.from({ length: 50 }, (_, i) => `s${i}`))!.length, 20);
  });
});

describe("subjectColumns", () => {
  it("takes the list and makes its first entry the primary subject", () => {
    assert.deepEqual(subjectColumns({ subjectIds: ["arabic", "mathematics"] }), {
      subjectId: "arabic",
      subjectIds: ["arabic", "mathematics"],
    });
  });
  it("clears both for an empty list", () => {
    assert.deepEqual(subjectColumns({ subjectIds: [] }), { subjectId: "", subjectIds: [] });
  });
  it("accepts a client that only sends subjectId", () => {
    assert.deepEqual(subjectColumns({ subjectId: " science " }), { subjectId: "science", subjectIds: ["science"] });
    assert.deepEqual(subjectColumns({ subjectId: "" }), { subjectId: "", subjectIds: [] });
  });
  it("prefers the list when both arrive", () => {
    assert.deepEqual(subjectColumns({ subjectId: "science", subjectIds: ["arabic"] })?.subjectIds, ["arabic"]);
  });
  it("leaves subjects alone when the body does not mention them", () => {
    assert.equal(subjectColumns({ name: "العاشر أ" }), undefined);
    assert.equal(subjectColumns(undefined), undefined);
  });
});

describe("withSubjectIds", () => {
  it("reads a row from before the column as a one-subject list", () => {
    assert.deepEqual(withSubjectIds({ subjectId: "mathematics", subjectIds: [] }).subjectIds, ["mathematics"]);
    assert.deepEqual(withSubjectIds({ subjectId: "mathematics" }).subjectIds, ["mathematics"]);
  });
  it("keeps a stored list", () => {
    assert.deepEqual(withSubjectIds({ subjectId: "arabic", subjectIds: ["arabic", "science"] }).subjectIds, ["arabic", "science"]);
  });
  it("is empty when neither is set", () => {
    assert.deepEqual(withSubjectIds({ subjectId: "", subjectIds: null }).subjectIds, []);
  });
});
