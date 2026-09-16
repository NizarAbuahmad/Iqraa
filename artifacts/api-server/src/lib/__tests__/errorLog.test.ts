/**
 * What this guards: what `/healthz/errors` is allowed to hand back.
 *
 * The buffer is fed automatically by every `logger.error(...)` in the codebase,
 * so its contents are decided by whatever context each of those calls happened
 * to pass — and one of them passes an address:
 * `logger.error({ userId, email }, "verification email not sent")`. It used to
 * spread the whole object, which made that endpoint a reader of any field a
 * future log line invents. The route is `ADMIN_DEBUG_KEY`-gated, so this is the
 * second lock rather than the only one, but a debugging endpoint is exactly the
 * kind that gets opened up later.
 *
 * The test that matters is the second one. The first only proves the buffer
 * still does its job.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { getRecentErrors, recordError } from "../errorLog.ts";

/** The newest record, which is the one the call under test just wrote. */
function latest() {
  const [first] = getRecentErrors();
  assert.ok(first, "expected a recorded error");
  return first;
}

describe("recordError", () => {
  it("keeps the message and the error's name and message", () => {
    recordError("generation failed", { err: new TypeError("bad shape") });

    const rec = latest();
    assert.equal(rec.message, "generation failed");
    assert.deepEqual(rec.detail?.["err"], { name: "TypeError", message: "bad shape" });
  });

  it("drops context fields that are not on the allowlist", () => {
    recordError("verification email not sent", {
      userId: "u-1",
      url: "/api/auth/register",
      // None of these may survive. `email` is the one a real call site passes.
      email: "teacher@example.com",
      password: "hunter2",
      body: { answer: "42" },
      authorization: "Bearer abc",
    });

    const detail = latest().detail ?? {};
    assert.equal(detail["userId"], "u-1", "an identifier says where it broke");
    assert.equal(detail["url"], "/api/auth/register");

    for (const leaked of ["email", "password", "body", "authorization"]) {
      assert.equal(leaked in detail, false, `${leaked} must not be retained`);
    }
  });

  it("keeps no stack, ever", () => {
    recordError("boom", { err: new Error("with a stack") });
    assert.equal("stack" in ((latest().detail?.["err"] ?? {}) as object), false);
  });

  it("records nothing for a detail with no allowlisted field", () => {
    recordError("bare", { email: "teacher@example.com" });
    assert.equal(latest().detail, undefined);
  });
});
