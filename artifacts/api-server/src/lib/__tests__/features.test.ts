/**
 * What this guards: the default.
 *
 * `studentAccountsEnabled()` being false unless explicitly turned on is the
 * whole of the v1 compliance posture — the privacy policy and terms both
 * state, in print, that no minor holds an account here. A flag that defaulted
 * to on, or that treated any truthy string as on, would make a published
 * legal document false without anything failing.
 */
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { studentAccountsEnabled } from "../features.ts";

const original = process.env.STUDENT_ACCOUNTS;

afterEach(() => {
  if (original === undefined) delete process.env.STUDENT_ACCOUNTS;
  else process.env.STUDENT_ACCOUNTS = original;
});

describe("studentAccountsEnabled", () => {
  it("is off when nothing is set", () => {
    delete process.env.STUDENT_ACCOUNTS;
    assert.equal(studentAccountsEnabled(), false);
  });

  it("is on only for the exact string 'true'", () => {
    process.env.STUDENT_ACCOUNTS = "true";
    assert.equal(studentAccountsEnabled(), true);
  });

  it("treats every other value as off, including the ones that look on", () => {
    // A flag read as truthy-string would turn student accounts on for "false".
    for (const value of ["false", "1", "0", "yes", "TRUE", "True", "", " true "]) {
      process.env.STUDENT_ACCOUNTS = value;
      assert.equal(studentAccountsEnabled(), false, JSON.stringify(value));
    }
  });

  it("is read at call time, so a change does not need a restart", () => {
    delete process.env.STUDENT_ACCOUNTS;
    assert.equal(studentAccountsEnabled(), false);
    process.env.STUDENT_ACCOUNTS = "true";
    assert.equal(studentAccountsEnabled(), true);
  });
});
