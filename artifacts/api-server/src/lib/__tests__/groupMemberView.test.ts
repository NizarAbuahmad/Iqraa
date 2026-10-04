import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { visibleGroupMembers } from "../groupMemberView.ts";

const isStaff = (role: string) => role === "teacher";
const members = [
  { userId: "t", role: "teacher" },
  { userId: "s1", role: "student" },
  { userId: "s2", role: "student" },
  { userId: "p1", role: "parent" },
];
const ids = (ms: { userId: string }[]) => ms.map(m => m.userId);

describe("visibleGroupMembers", () => {
  it("gives a student in an announcement-only group the staff and themselves, not the class", () => {
    const out = visibleGroupMembers({ members, viewerId: "s1", viewerIsOwner: false, studentPostingEnabled: false, isStaff });
    assert.deepEqual(ids(out), ["t", "s1"]);
  });

  it("does the same for a parent", () => {
    const out = visibleGroupMembers({ members, viewerId: "p1", viewerIsOwner: false, studentPostingEnabled: false, isStaff });
    assert.deepEqual(ids(out), ["t", "p1"]);
  });

  it("gives the owner and any staff member everyone", () => {
    assert.equal(visibleGroupMembers({ members, viewerId: "t", viewerIsOwner: true, studentPostingEnabled: false, isStaff }).length, 4);
    const coTeacher = [...members, { userId: "t2", role: "teacher" }];
    assert.equal(visibleGroupMembers({ members: coTeacher, viewerId: "t2", viewerIsOwner: false, studentPostingEnabled: false, isStaff }).length, 5);
  });

  it("keeps the full list where students may post, so each message has a name", () => {
    const out = visibleGroupMembers({ members, viewerId: "s1", viewerIsOwner: false, studentPostingEnabled: true, isStaff });
    assert.equal(out.length, 4);
  });
});
