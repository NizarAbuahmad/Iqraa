/**
 * What this guards: a child taught by two teachers is two roster rows
 * (`students` is teacher-owned), so a parent linked to both would otherwise
 * see the same child twice on the schedule. Grouping is by name, within one
 * parent's own links only — never across accounts.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { groupChildren, normalizeChildName } from "../children.ts";

describe("normalizeChildName", () => {
  it("ignores case, outer whitespace and repeated inner spaces", () => {
    assert.equal(normalizeChildName("  Sara   Haddad "), normalizeChildName("sara haddad"));
  });

  it("does not merge different names", () => {
    assert.notEqual(normalizeChildName("سارة"), normalizeChildName("سلمى"));
  });
});

describe("groupChildren", () => {
  it("merges rows with the same name into one child", () => {
    const groups = groupChildren([
      { studentId: "b", displayName: "سارة" },
      { studentId: "a", displayName: "سارة " },
    ]);
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0], { key: "a", displayName: "سارة", studentIds: ["a", "b"] });
  });

  it("keeps different names apart", () => {
    const groups = groupChildren([
      { studentId: "a", displayName: "سارة" },
      { studentId: "b", displayName: "أحمد" },
    ]);
    assert.equal(groups.length, 2);
    assert.deepEqual(new Set(groups.map(g => g.displayName)), new Set(["سارة", "أحمد"]));
  });

  it("collapses a repeated row for the same student", () => {
    const groups = groupChildren([
      { studentId: "a", displayName: "Sara" },
      { studentId: "a", displayName: "Sara" },
    ]);
    assert.deepEqual(groups, [{ key: "a", displayName: "Sara", studentIds: ["a"] }]);
  });

  it("is stable whatever order the database returns the rows in", () => {
    const rows = [
      { studentId: "c", displayName: "Omar" },
      { studentId: "a", displayName: "Sara" },
      { studentId: "b", displayName: "Sara" },
    ];
    assert.deepEqual(groupChildren(rows), groupChildren([...rows].reverse()));
  });

  it("returns nothing for no links", () => {
    assert.deepEqual(groupChildren([]), []);
  });
});
