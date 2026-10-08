/**
 * What this guards: a signup used to answer "check your email" whether or not
 * an email went out. A missing RESEND_API_KEY, an unverified sender domain or a
 * provider rejection only reached the log, and the teacher sat on the code
 * screen waiting for a message that was never sent. These are the answers the
 * three endpoints give for each combination, so the app can say so.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  changeEmailResponse,
  registerResponse,
  resendResponse,
} from "../verificationDelivery.ts";

describe("registerResponse", () => {
  it("says the code was sent when it was", () => {
    const body = registerResponse("a@b.co", true);
    assert.equal(body.email, "a@b.co");
    assert.equal(body.emailSent, true);
    assert.match(body.message, /check your email/i);
  });

  it("says plainly that it was not, and does not tell the caller to check their inbox", () => {
    const body = registerResponse("a@b.co", false);
    assert.equal(body.emailSent, false);
    assert.doesNotMatch(body.message, /check your email/i);
    assert.match(body.message, /could not send/i);
  });
});

describe("changeEmailResponse", () => {
  it("carries emailSent through, for the new address", () => {
    assert.deepEqual(changeEmailResponse("new@b.co", true), {
      email: "new@b.co",
      emailSent: true,
      message: "A new code was sent to that address.",
    });
    const failed = changeEmailResponse("new@b.co", false);
    assert.equal(failed.emailSent, false);
    assert.doesNotMatch(failed.message, /was sent/i);
  });
});

describe("resendResponse", () => {
  it("answers 200 when a code was sent", () => {
    const res = resendResponse(true, true);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
  });

  it("answers 503 email_unavailable when the account needed a code and the send failed", () => {
    const res = resendResponse(true, false);
    assert.equal(res.status, 503);
    assert.equal(res.body.code, "email_unavailable");
  });

  it("answers exactly the same 200 body whether or not an address needed a code", () => {
    // Unknown address, or one already verified: nothing was attempted, so no
    // send could have failed, and the caller must not be able to tell.
    const nothingToSend = resendResponse(false, false);
    assert.equal(nothingToSend.status, 200);
    assert.deepEqual(nothingToSend.body, resendResponse(true, true).body);
  });
});
