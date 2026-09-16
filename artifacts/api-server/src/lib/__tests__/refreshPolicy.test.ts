/**
 * What this guards: how long a stolen refresh token is worth anything, and
 * whether the theft is noticed at all.
 *
 * Refresh tokens live in the keychain on native and in `localStorage` on web,
 * and the web build is production — app.iqrra.com, with no `script-src` policy
 * yet. So the web TTL is the blast radius of any XSS, and reuse detection is
 * the only thing that turns a silent theft into a signed-out user who knows
 * something happened.
 *
 * The ordering assertion at the bottom is the subtle one and the easiest to
 * "simplify" away later.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  decideRefresh,
  NATIVE_REFRESH_TTL_MS,
  refreshTokenTtlMs,
  REUSE_GRACE_MS,
  WEB_REFRESH_TTL_MS,
} from "../refreshPolicy.ts";

describe("refreshTokenTtlMs", () => {
  it("gives a browser the short term", () => {
    assert.equal(refreshTokenTtlMs("https://app.iqrra.com"), WEB_REFRESH_TTL_MS);
  });

  it("gives a request with no Origin the long one", () => {
    // Every native app request, plus curl and the Cloud Run health check.
    // Absent must mean native: it is the branch that cannot sign anyone out
    // early, which is the safe direction for a header we do not control.
    assert.equal(refreshTokenTtlMs(undefined), NATIVE_REFRESH_TTL_MS);
  });

  it("keeps web well short of native", () => {
    assert.ok(
      WEB_REFRESH_TTL_MS < NATIVE_REFRESH_TTL_MS,
      "the whole point is that the localStorage copy expires sooner",
    );
    assert.ok(
      WEB_REFRESH_TTL_MS >= 7 * 24 * 60 * 60 * 1000,
      "a teacher working Sunday to Thursday must not be asked to sign in twice",
    );
  });
});

describe("decideRefresh", () => {
  const now = new Date("2026-09-16T12:00:00Z");
  const live = {
    familyId: "fam-1",
    rotatedAt: null,
    expiresAt: new Date("2026-09-20T12:00:00Z"),
  };

  it("rotates a live token, keeping it in its own family", () => {
    const out = decideRefresh(live, now);
    assert.deepEqual(out, { action: "rotate", familyId: "fam-1" });
  });

  it("rejects a token it has never seen", () => {
    assert.deepEqual(decideRefresh(undefined, now), { action: "reject" });
  });

  it("rejects a live-but-expired token without touching the family", () => {
    const expired = { ...live, expiresAt: new Date("2026-09-15T12:00:00Z") };
    assert.deepEqual(decideRefresh(expired, now), { action: "reject" });
  });

  it("revokes the family when a retired token comes back", () => {
    // The replay. The client that rotated this token holds its successor, so
    // nobody legitimate presents this one — there are two copies in the world
    // and no way to tell which caller is the owner.
    const retired = { ...live, rotatedAt: new Date("2026-09-16T11:00:00Z") };
    assert.deepEqual(decideRefresh(retired, now), {
      action: "revoke_family",
      familyId: "fam-1",
    });
  });

  it("forgives a repeat within the grace window — that is two tabs, not a thief", () => {
    /*
     * `apiClient.ts` has a single-flight latch, but it is a module-level
     * variable and two browser tabs are two module instances. Both can hold
     * the same token, both can see the access token expire on the same tick,
     * and both can post it. Revoking there would sign a teacher out of
     * everything, intermittently, for doing nothing wrong.
     *
     * Still a 401 — no token is issued inside the window either. Only the
     * revocation is withheld.
     */
    const justRotated = {
      ...live,
      rotatedAt: new Date(now.getTime() - (REUSE_GRACE_MS - 1_000)),
    };
    assert.deepEqual(decideRefresh(justRotated, now), { action: "reject" });
  });

  it("stops forgiving once the window has passed", () => {
    const afterGrace = {
      ...live,
      rotatedAt: new Date(now.getTime() - (REUSE_GRACE_MS + 1_000)),
    };
    assert.deepEqual(decideRefresh(afterGrace, now), {
      action: "revoke_family",
      familyId: "fam-1",
    });
  });

  it("still revokes when the replayed token is also expired", () => {
    /*
     * The ordering assertion. Checking expiry first reads more naturally and
     * is wrong: a token that is both retired and past its term is still proof
     * somebody replayed it, and the family may hold a live successor an
     * attacker is using right now. Answering "reject" would leave that
     * successor alone and throw away the only signal there was.
     */
    const retiredAndExpired = {
      ...live,
      rotatedAt: new Date("2026-09-14T12:00:00Z"),
      expiresAt: new Date("2026-09-15T12:00:00Z"),
    };
    assert.deepEqual(decideRefresh(retiredAndExpired, now), {
      action: "revoke_family",
      familyId: "fam-1",
    });
  });
});
