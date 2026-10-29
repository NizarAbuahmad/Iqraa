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
  hasTeachingData: async () => false,
};

const decide = (over: Partial<RoleSwitchInput>) => decideRoleSwitch({ ...base, ...over });

describe("decideRoleSwitch", () => {
  it("lets an unlinked parent become a teacher", async () => {
    assert.deepEqual(await decide({}), { ok: true, role: "teacher", changed: true });
  });

  it("lets an unlinked parent become a student, once they confirm their age", async () => {
    assert.deepEqual(
      await decide({ requestedRole: "student", ageConfirmed: true }),
      { ok: true, role: "student", changed: true },
    );
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

  it("lets a teacher with no classes or students become a parent or student", async () => {
    for (const requestedRole of ["parent", "student"] as const) {
      assert.deepEqual(
        await decide({ currentRole: "teacher", requestedRole, ageConfirmed: true }),
        { ok: true, role: requestedRole, changed: true },
      );
    }
  });

  it("refuses a teacher who owns a class or a student", async () => {
    const d = await decide({ currentRole: "teacher", requestedRole: "parent", hasTeachingData: async () => true });
    assert.equal(d.ok === false && d.code, "role_locked_teaching");
    assert.equal(d.ok === false && d.status, 409);
  });

  it("refuses a teacher moving into parent/student while student accounts are off", async () => {
    const d = await decide({ currentRole: "teacher", requestedRole: "parent", studentAccountsEnabled: false });
    assert.equal(d.ok === false && d.code, "student_accounts_disabled");
  });

  it("refuses an account that is none of the three (admins)", async () => {
    const d = await decide({ currentRole: "admin", requestedRole: "parent" });
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
    await decide({ currentRole: "teacher", requestedRole: "parent", hasRosterLink });
    assert.equal(calls, 0);
  });

  describe("age confirmation when becoming a student", () => {
    // A student who signs up with an email confirms they are an adult or have a
    // guardian's agreement (lib/ageConfirmation.ts). Switching an existing
    // account into the role is the same act by another door, so it asks too.
    it("refuses a switch into student that did not confirm, with a code the screen can translate", async () => {
      for (const currentRole of ["teacher", "parent"]) {
        const d = await decide({ currentRole, requestedRole: "student" });
        assert.equal(d.ok, false, currentRole);
        assert.equal(d.ok === false && d.code, "age_confirmation_required");
        assert.equal(d.ok === false && d.status, 400);
      }
    });

    it("takes only a literal true", async () => {
      for (const ageConfirmed of [undefined, false, "true", 1] as unknown as boolean[]) {
        const d = await decide({ requestedRole: "student", ageConfirmed });
        assert.equal(d.ok, false, String(ageConfirmed));
      }
    });

    it("does not ask for a switch into teacher or parent", async () => {
      assert.deepEqual(await decide({ currentRole: "student", requestedRole: "teacher" }), { ok: true, role: "teacher", changed: true });
      assert.deepEqual(await decide({ currentRole: "student", requestedRole: "parent" }), { ok: true, role: "parent", changed: true });
      assert.deepEqual(await decide({ currentRole: "teacher", requestedRole: "parent" }), { ok: true, role: "parent", changed: true });
    });

    it("does not ask a student to confirm again for staying a student", async () => {
      assert.deepEqual(
        await decide({ currentRole: "student", requestedRole: "student" }),
        { ok: true, role: "student", changed: false },
      );
    });

    it("reports the real blocker first, so the answer stays truthful", async () => {
      // A linked account is refused for being linked, not for a missing tick.
      const linked = await decide({ requestedRole: "student", hasRosterLink: async () => true });
      assert.equal(linked.ok === false && linked.code, "role_locked_linked");
      const teaching = await decide({ currentRole: "teacher", requestedRole: "student", hasTeachingData: async () => true });
      assert.equal(teaching.ok === false && teaching.code, "role_locked_teaching");
      const off = await decide({ requestedRole: "student", studentAccountsEnabled: false });
      assert.equal(off.ok === false && off.code, "student_accounts_disabled");
    });
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
