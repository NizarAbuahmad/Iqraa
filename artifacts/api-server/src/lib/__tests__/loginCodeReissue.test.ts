/**
 * What this guards: who a teacher may reissue a login code for.
 *
 * A code-only student can add an email and password later (`/auth/add-email`),
 * which used to end the teacher's ability to reissue: the account "has a
 * password". But the address starts unverified and password sign-in needs a
 * verified one, so a student who mistyped it, then lost the code, was locked
 * out of both doors. Reissue stays open until the email is verified.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { canReissueLoginCode } from "../loginCodeReissue.ts";

const codeOnly = { loginCodeHash: "h", passwordHash: null, googleId: null, emailVerified: false };

describe("canReissueLoginCode", () => {
  it("allows a plain code-only account", () => {
    assert.equal(canReissueLoginCode(codeOnly), true);
  });

  it("allows an account that added an email but never verified it", () => {
    assert.equal(canReissueLoginCode({ ...codeOnly, passwordHash: "p", emailVerified: false }), true);
  });

  it("refuses once the email is verified — it can reset its own password", () => {
    assert.equal(canReissueLoginCode({ ...codeOnly, passwordHash: "p", emailVerified: true }), false);
  });

  it("refuses an account linked to Google", () => {
    assert.equal(canReissueLoginCode({ ...codeOnly, googleId: "g" }), false);
  });

  it("refuses an account that never had a login code", () => {
    assert.equal(canReissueLoginCode({ ...codeOnly, loginCodeHash: null }), false);
  });
});
