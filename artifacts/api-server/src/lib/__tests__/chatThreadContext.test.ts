/**
 * What a direct chat row can say about the other person: which students link
 * the two of them.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/chatThreadContext.test.ts
 *
 * The inbox used to show only the other person's role, so a parent with two
 * children, or a teacher with two parents, could not tell the rows apart. The
 * query behind this is one batch for every thread, so the grouping has to key
 * on the (teacher, other user) pair — a wrong key would hang a student's name
 * on someone else's thread.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { pairKey, studentNamesByPair } from "../chatThreadContext.ts";

describe("studentNamesByPair", () => {
  it("groups student names under the teacher/user pair that links them", () => {
    const map = studentNamesByPair([
      { teacherId: "t1", userId: "p1", studentName: "خالد" },
      { teacherId: "t1", userId: "p1", studentName: "سارة" },
      { teacherId: "t1", userId: "p2", studentName: "ليث" },
      { teacherId: "t2", userId: "p1", studentName: "نور" },
    ]);
    assert.deepEqual(map.get(pairKey("t1", "p1")), ["خالد", "سارة"]);
    assert.deepEqual(map.get(pairKey("t1", "p2")), ["ليث"]);
    assert.deepEqual(map.get(pairKey("t2", "p1")), ["نور"]);
  });

  it("does not mix up which side is the teacher", () => {
    const map = studentNamesByPair([{ teacherId: "t1", userId: "p1", studentName: "خالد" }]);
    assert.equal(map.get(pairKey("p1", "t1")), undefined);
  });

  it("lists a student once even when two links point at the same pair", () => {
    // A student can be linked as 'self' and as a guardian relation by the same
    // user, or sit in a roster twice under one name.
    const map = studentNamesByPair([
      { teacherId: "t1", userId: "p1", studentName: "خالد" },
      { teacherId: "t1", userId: "p1", studentName: "خالد" },
    ]);
    assert.deepEqual(map.get(pairKey("t1", "p1")), ["خالد"]);
  });

  it("skips blank names and returns an empty map for no rows", () => {
    assert.equal(studentNamesByPair([]).size, 0);
    const map = studentNamesByPair([{ teacherId: "t1", userId: "p1", studentName: "  " }]);
    assert.equal(map.get(pairKey("t1", "p1")), undefined);
  });
});
