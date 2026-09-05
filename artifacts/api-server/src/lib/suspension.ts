/**
 * What a suspended account may still reach.
 *
 * Split out of `middlewares/auth.ts` so it can be unit-tested: that file
 * imports `@workspace/db`, which throws at module scope without a
 * DATABASE_URL, so nothing in it can be loaded by `node --test`. Same reason
 * `routeGating.ts` exists on the mobile side.
 *
 * Worth testing rather than eyeballing, because both directions fail badly
 * and neither is visible: match too widely and an ejected user keeps the
 * route, match too narrowly and a suspended person cannot delete their own
 * account — which the privacy policy promises without conditions.
 */

/**
 * `GET /auth/me` so the app can say *why* everything else stopped working; an
 * ejected user who only sees failures has nothing to appeal against.
 *
 * `DELETE /auth/users/me` because the right to erasure does not pause during
 * a suspension. Losing the record of an abuser who deletes is the accepted
 * cost — they could register again from a new address regardless, so the
 * suspension was never what stopped them.
 */
const SUSPENDED_MAY_REACH = new Set(["GET /auth/me", "DELETE /auth/users/me"]);

/**
 * `METHOD /path`, normalised.
 *
 * Express's `req.path` is relative to wherever the router was mounted, and
 * this middleware is installed two different ways (`router.use("/chat",
 * authMiddleware)` and as a per-route argument), so the same request can
 * present two different `path` values. `originalUrl` does not vary, so it is
 * what gets matched — minus the query string, the `/api` mount prefix, and
 * any trailing slash.
 */
export function routeKey(method: string, originalUrl: string): string {
  const path = originalUrl.split("?")[0].replace(/^\/api(?=\/|$)/, "").replace(/\/+$/, "");
  return `${method.toUpperCase()} ${path || "/"}`;
}

/** True when a suspended account is still allowed through to this request. */
export function suspendedMayReach(method: string, originalUrl: string): boolean {
  return SUSPENDED_MAY_REACH.has(routeKey(method, originalUrl));
}
