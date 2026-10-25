import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { decideRoleSwitch } from "../roleSwitch.ts";

const base = {
  currentRole: "teacher",
  requestedRole: "student",
  studentAccountsEnabled: true,
  hasRosterLink: async () => false,
  hasTeachingData: async () => false,
};

describe("decideRoleSwitch with a parent's approval instead of the tick", () => {
  it("still asks for the tick by default", async () => {
    const d = await decideRoleSwitch(base);
    assert.equal(d.ok, false);
    if (!d.ok) assert.equal(d.code, "age_confirmation_required");
  });
  it("does not ask for it when ageTickRequired is false", async () => {
    const d = await decideRoleSwitch({ ...base, ageTickRequired: false });
    assert.deepEqual(d, { ok: true, role: "student", changed: true });
  });
  it("still refuses a linked or teaching account first, whatever the tick setting", async () => {
    const linked = await decideRoleSwitch({ ...base, currentRole: "parent", ageTickRequired: false, hasRosterLink: async () => true });
    assert.equal(linked.ok, false);
    if (!linked.ok) assert.equal(linked.code, "role_locked_linked");
    const teaching = await decideRoleSwitch({ ...base, ageTickRequired: false, hasTeachingData: async () => true });
    assert.equal(teaching.ok, false);
    if (!teaching.ok) assert.equal(teaching.code, "role_locked_teaching");
  });
});
