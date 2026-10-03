import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildLinkNotification } from "../linkNotifyMessage.ts";

const base = { joinerName: "منى سعيد", joinerEmail: "mona@example.com", studentName: "سعيد أحمد", studentId: "s1" };

describe("buildLinkNotification", () => {
  it("names the joiner, their role, the child and their email", () => {
    const m = buildLinkNotification({ ...base, relation: "guardian" });
    assert.match(m.body, /منى سعيد \(ولي أمر\)/);
    assert.match(m.body, /«سعيد أحمد»/);
    assert.match(m.body, /mona@example\.com/);
  });

  it("calls a self-link a student, and deep-links to that student", () => {
    const m = buildLinkNotification({ ...base, relation: "self" });
    assert.match(m.body, /\(طالب\)/);
    assert.deepEqual(m.data, { screen: "student-link", studentId: "s1" });
  });

  it("falls back to the email when the account has no name", () => {
    const m = buildLinkNotification({ ...base, joinerName: "  ", relation: "guardian" });
    assert.ok(m.body.startsWith("mona@example.com (ولي أمر)"));
  });
});
