/**
 * What this guards: registration and password-reset used to accept any
 * 8-character string, including all-digit and dictionary-word passwords.
 * The policy must reject those without demanding a symbol, which would just
 * push pilot teachers toward writing passwords down.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { canAdminSetPassword, isStrongPassword } from "../passwordPolicy.ts";

describe("isStrongPassword", () => {
  it("accepts a password with a letter and a digit", () => {
    assert.equal(isStrongPassword("teacher123"), true);
  });

  it("rejects a password shorter than 8 characters", () => {
    assert.equal(isStrongPassword("abc123"), false);
  });

  it("rejects an all-digit password", () => {
    assert.equal(isStrongPassword("12345678"), false);
  });

  it("rejects a letters-only password", () => {
    assert.equal(isStrongPassword("passwordonly"), false);
  });

  it("accepts non-Latin letters combined with a digit", () => {
    assert.equal(isStrongPassword("مرحبا123"), true);
  });
});

/**
 * What these guard: `POST /admin/users/:id/password` is the only way to set
 * an account's password from outside that account. If it ever accepts an
 * admin as its target, one compromised admin token takes over every other
 * admin permanently — the escalation the endpoint's 403 exists to prevent.
 */
describe("canAdminSetPassword", () => {
  it("lets a system_admin set an ordinary user's password", () => {
    for (const role of ["teacher", "student", "parent"]) {
      assert.equal(canAdminSetPassword("system_admin", { role }), true, role);
    }
  });

  it("refuses to target another system_admin — including the actor itself", () => {
    assert.equal(canAdminSetPassword("system_admin", { role: "system_admin" }), false);
  });

  it("refuses to target a school_admin", () => {
    assert.equal(canAdminSetPassword("system_admin", { role: "school_admin" }), false);
  });

  it("refuses every actor that is not a system_admin", () => {
    for (const role of ["school_admin", "teacher", "student", "parent", ""]) {
      assert.equal(canAdminSetPassword(role, { role: "teacher" }), false, role);
    }
  });
});
