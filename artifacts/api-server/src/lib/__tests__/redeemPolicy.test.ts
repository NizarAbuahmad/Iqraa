/**
 * What this guards: the two decisions that are new when a parent or student
 * creates an account from a teacher's code alone.
 *
 * 1. A parent may not do it with a class code. A class code is one string for a
 *    whole room and its picker lists every child's name, so letting it mint a
 *    parent account with no email, no password and no verification would let
 *    anyone holding it become "the parent" of any unclaimed child. A parent
 *    needs the code written for their child.
 * 2. A new account needs a name, and none was typed: it comes from the roster.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { namesForNewAccount, redeemRoleCheck } from "../redeemPolicy.ts";

describe("redeemRoleCheck", () => {
  const viaClass = { ok: true as const, studentId: "s", relation: "guardian" as const, viaClassCode: true };
  const viaStudent = { ...viaClass, viaClassCode: false };

  it("lets a parent in with the code written for their child", () => {
    assert.deepEqual(redeemRoleCheck("parent", viaStudent), { ok: true });
  });

  it("refuses a parent holding only a class code, with a code the screen can translate", () => {
    const got = redeemRoleCheck("parent", { ...viaClass });
    assert.equal(got.ok, false);
    assert.equal(got.ok === false && got.status, 400);
    assert.equal(got.ok === false && got.code, "claim_parent_needs_student_code");
  });

  it("lets a student in with either kind — they pick their own name off the list", () => {
    const self = { ...viaClass, relation: "self" as const };
    assert.deepEqual(redeemRoleCheck("student", self), { ok: true });
    assert.deepEqual(redeemRoleCheck("student", { ...self, viaClassCode: false }), { ok: true });
  });
});

describe("namesForNewAccount", () => {
  it("splits a student's roster name into first and the rest", () => {
    assert.deepEqual(namesForNewAccount("student", "أحمد خالد المصري"), {
      firstName: "أحمد",
      lastName: "خالد المصري",
    });
  });

  it("keeps a single-word roster name whole and leaves the last name empty", () => {
    assert.deepEqual(namesForNewAccount("student", "ميمي"), { firstName: "ميمي", lastName: "" });
  });

  it("collapses stray whitespace", () => {
    assert.deepEqual(namesForNewAccount("student", "  سارة   علي "), { firstName: "سارة", lastName: "علي" });
  });

  it("calls a parent «ولي أمر» followed by the child's name, so a teacher can tell whose parent writes", () => {
    assert.deepEqual(namesForNewAccount("parent", "أحمد خالد"), { firstName: "ولي أمر", lastName: "أحمد خالد" });
  });

  it("never returns an empty first name, which the column forbids", () => {
    assert.equal(namesForNewAccount("student", "   ").firstName, "طالب");
    assert.equal(namesForNewAccount("parent", "").firstName, "ولي أمر");
  });
});
