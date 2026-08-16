/**
 * What this guards: registration and password-reset used to accept any
 * 8-character string, including all-digit and dictionary-word passwords.
 * The policy must reject those without demanding a symbol, which would just
 * push pilot teachers toward writing passwords down.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { isStrongPassword } from "../passwordPolicy.ts";

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
