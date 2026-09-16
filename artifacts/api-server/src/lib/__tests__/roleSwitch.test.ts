/**
 * What this guards: the one door that rewrites `users.role` after signup.
 *
 * It exists so a parent/student stranded on `/claim-required` can fix a role
 * they picked wrong — which means it must stay shut for every account where
 * the role already means something: a teacher, and anyone holding a roster
 * link. Checked here and not through the route for the reason
 * ../roleSwitch.ts gives: reaching @workspace/db needs a live database.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { decideRoleSwitch, type RoleSwitchInput } from "../roleSwitch.ts";

/** An unlinked parent with the flag on — each test opts into what it changes. */
const base: RoleSwitchInput = {
  currentRole: "parent",
  requestedRole: "teacher",
  studentAccountsEnabled: true,
  hasRosterLink: async () => false,
};

const decide = (over: Partial<RoleSwitchInput>) => decideRoleSwitch({ ...base, ...over });

describe("decideRoleSwitch", () => {
  it("lets an unlinked parent become a teacher", async () => {
    assert.deepEqual(await decide({}), { ok: true, role: "teacher", changed: true });
  });

  it("lets an unlinked parent become a student", async () => {
    assert.deepEqual(await decide({ requestedRole: "student" }), { ok: true, role: "student", changed: true });
  });

  it("reports the same role as no change, so the route skips the write", async () => {
    assert.deepEqual(await decide({ requestedRole: "parent" }), { ok: true, role: "parent", changed: false });
  });

  it("refuses a role that isn't one of the three", async () => {
    for (const requestedRole of ["admin", "", "   ", null, undefined, 7, { role: "teacher" }]) {
      const d = await decide({ requestedRole });
      assert.equal(d.ok, false, `accepted ${JSON.stringify(requestedRole)}`);
      assert.equal(d.ok === false && d.code, "role_invalid");
    }
  });

  it("refuses a teacher — this is not a way out of a teacher account", async () => {
    const d = await decide({ currentRole: "teacher", requestedRole: "parent" });
    assert.equal(d.ok === false && d.code, "role_locked");
    assert.equal(d.ok === false && d.status, 403);
  });

  it("refuses once a roster link exists, even for the same role", async () => {
    for (const requestedRole of ["teacher", "parent", "student"]) {
      const d = await decide({ requestedRole, hasRosterLink: async () => true });
      assert.equal(d.ok === false && d.code, "role_locked_linked");
      assert.equal(d.ok === false && d.status, 409);
    }
  });

  it("asks about roster links at most once, and only when the request could succeed", async () => {
    let calls = 0;
    const hasRosterLink = async () => { calls += 1; return false; };
    await decide({ hasRosterLink });
    assert.equal(calls, 1);
    calls = 0;
    await decide({ requestedRole: "admin", hasRosterLink });
    await decide({ currentRole: "teacher", hasRosterLink });
    assert.equal(calls, 0);
  });

  it("closes parent and student, but not teacher, when student accounts are off", async () => {
    const off = { studentAccountsEnabled: false };
    for (const requestedRole of ["parent", "student"]) {
      const d = await decide({ ...off, requestedRole });
      assert.equal(d.ok === false && d.code, "student_accounts_disabled");
    }
    assert.deepEqual(await decide({ ...off, requestedRole: "teacher" }), { ok: true, role: "teacher", changed: true });
  });
});
