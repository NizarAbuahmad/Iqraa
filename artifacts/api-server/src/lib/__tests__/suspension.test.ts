/**
 * What this guards: the allowlist a suspended account is measured against.
 *
 * Both directions fail silently. Match too widely and an ejected user keeps
 * a route they were supposed to lose — nothing errors, the abuse just
 * continues. Match too narrowly and a suspended person cannot delete their
 * own account, which the privacy policy promises without conditions, so the
 * failure is a published false statement rather than a bug report.
 *
 * The normalisation is the fiddly part: this middleware is installed both as
 * `router.use("/chat", authMiddleware)` and as a per-route argument, so the
 * same request can present two different `req.path` values. `originalUrl` is
 * what gets matched, and it always carries the `/api` mount prefix.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { routeKey, suspendedMayReach } from "../suspension.ts";

describe("routeKey", () => {
  it("strips the /api mount prefix, the query and a trailing slash", () => {
    assert.equal(routeKey("GET", "/api/auth/me"), "GET /auth/me");
    assert.equal(routeKey("GET", "/api/auth/me/"), "GET /auth/me");
    assert.equal(routeKey("GET", "/api/auth/me?fresh=1"), "GET /auth/me");
  });

  it("upper-cases the method, because Express does not promise to", () => {
    assert.equal(routeKey("delete", "/api/auth/users/me"), "DELETE /auth/users/me");
  });

  it("only strips /api as a whole segment", () => {
    // A future route beginning "api…" must not have four characters eaten.
    assert.equal(routeKey("GET", "/api/apidocs"), "GET /apidocs");
    assert.equal(routeKey("GET", "/apiary/thing"), "GET /apiary/thing");
  });
});

describe("suspendedMayReach", () => {
  it("lets a suspended user read why, and delete their account", () => {
    assert.equal(suspendedMayReach("GET", "/api/auth/me"), true);
    assert.equal(suspendedMayReach("DELETE", "/api/auth/users/me"), true);
  });

  it("closes everything else, including near neighbours", () => {
    for (const [method, url] of [
      ["GET", "/api/messaging/threads"],
      ["POST", "/api/messaging/messages"],
      ["POST", "/api/generate/lesson-plan"],
      ["GET", "/api/students"],
      ["PATCH", "/api/auth/users/profile"],
      // Same path, wrong method: reading /auth/me is allowed, writing is not.
      ["POST", "/api/auth/me"],
      ["DELETE", "/api/auth/me"],
      // Deleting *someone else* is not the erasure right.
      ["DELETE", "/api/auth/users/2f1c9b7e-0000-0000-0000-000000000000"],
    ] as const) {
      assert.equal(suspendedMayReach(method, url), false, `${method} ${url}`);
    }
  });

  it("is not fooled by a path that merely starts the same way", () => {
    assert.equal(suspendedMayReach("GET", "/api/auth/members"), false);
    assert.equal(suspendedMayReach("DELETE", "/api/auth/users/mentor"), false);
  });
});
