/**
 * How long a refresh token lives, and what to do when one comes back twice.
 *
 * Split out of `routes/auth.ts` for the reason `googleLink.ts`, `claimDecision.ts`
 * and `suspension.ts` are: that file imports `@workspace/db` at module scope and
 * throws without a DATABASE_URL, so nothing declared inside it is reachable from
 * `node --test`. Both rules below are worth asserting — one decides how long a
 * stolen credential is useful, the other decides whether a theft is noticed at
 * all.
 */

/** Native apps. Long, because a teacher should not be signed out of their phone. */
export const NATIVE_REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Browsers. Short, because the token is sitting in `localStorage`.
 *
 * `secureStorage.ts` puts refresh tokens in the keychain on native and in
 * `localStorage` on web, and its header still claims the web target is only a
 * development preview. It has not been that since app.iqrra.com went live on
 * Cloudflare Pages. `public/_headers` also carries no `script-src` policy yet,
 * so there is nothing standing between an XSS and that value.
 *
 * The TTL is what decides how long the theft is worth anything, and 30 days on
 * a value readable by any script on the page is the wrong number. Seven still
 * spans a school week — a teacher who works Sunday to Thursday is not asked to
 * sign in twice — while cutting the window by more than four fifths.
 */
export const WEB_REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Which one applies, decided by whether an `Origin` header arrived.
 *
 * Browsers set `Origin` on cross-origin requests and the web app is always
 * cross-origin to this API (app.iqrra.com calling a run.app host — the reason
 * the CORS allowlist in app.ts exists at all). React Native's fetch does not
 * set it.
 *
 * A client-declared field would have been the obvious alternative and is worse
 * in the way that matters: it is read at *issuance*, from whoever is signing
 * in. Spoofing it buys an attacker nothing they can use, because the victim's
 * legitimate login is what sets their token's term — but a native client that
 * one day starts sending a `client: "web"` string by accident would silently
 * halve every teacher's session. `Origin` is set by the platform, not by our
 * code, so it cannot drift.
 *
 * An absent header therefore means native, and native is the generous branch.
 * That is the safe direction to be wrong in for a header that is absent on
 * curl and on the Cloud Run health check too.
 */
export function refreshTokenTtlMs(origin: string | undefined): number {
  return origin ? WEB_REFRESH_TTL_MS : NATIVE_REFRESH_TTL_MS;
}

/** The row `/auth/refresh` found for the presented token, or nothing. */
export interface StoredRefreshToken {
  familyId: string;
  rotatedAt: Date | null;
  expiresAt: Date;
}

/**
 * How soon after a rotation a repeat presentation is read as a race rather
 * than a replay.
 *
 * `apiClient.ts` holds a single-flight latch so one client never refreshes
 * twice at once — but that latch is a module-level variable, and two browser
 * tabs are two module instances. Both can hold the same refresh token, both
 * can see their access token expire on the same tick, and both can post it.
 * One rotates; the other arrives to find a retired row.
 *
 * Without a window that honest second tab would revoke the family and sign the
 * teacher out of every tab and their phone, intermittently, in a way nobody
 * could reproduce on purpose. With one, it gets a 401, signs that tab out
 * locally, and the session survives.
 *
 * It costs less than it looks. A replay inside the window still gets nothing —
 * the answer is 401 either way, and no new token is issued. All that is given
 * up is *detection* during the seconds either side of a legitimate rotation,
 * and an attacker who could reliably land inside that window could equally
 * have raced the rotation itself.
 *
 * ponytail: the real fix for web is a cross-tab lock (`navigator.locks`), which
 * would make the race impossible rather than forgiven. That is client work in
 * a browser-only API, and this is the server-side half that has to exist
 * regardless — a server cannot assume every client holds a lock.
 */
export const REUSE_GRACE_MS = 30_000;

export type RefreshOutcome =
  /** No such token, or it has expired. Answer 401 and change nothing. */
  | { action: "reject" }
  /**
   * The token was already exchanged for a successor. Nobody legitimate presents
   * a retired token — the client that rotated it holds the replacement — so
   * this is a replay, and the holder of the copy is as likely to be an attacker
   * as the person whose browser was read. End the whole chain.
   */
  | { action: "revoke_family"; familyId: string }
  /** Ordinary rotation: retire this row, issue a successor in the same family. */
  | { action: "rotate"; familyId: string };

export function decideRefresh(
  stored: StoredRefreshToken | undefined,
  now: Date,
): RefreshOutcome {
  if (!stored) return { action: "reject" };

  /*
   * Reuse is checked before expiry, deliberately.
   *
   * A token that is both retired and past its term is still evidence that
   * someone replayed it, and the family it belongs to may contain a live
   * successor an attacker is using right now. Checking expiry first would
   * answer "reject", leave that successor alone, and throw away the only signal
   * there was.
   */
  if (stored.rotatedAt !== null) {
    // Inside the grace window this is two tabs racing, not a theft. Refuse the
    // request — no new token either way — but leave the family standing.
    const sinceRotation = now.getTime() - stored.rotatedAt.getTime();
    if (sinceRotation >= 0 && sinceRotation <= REUSE_GRACE_MS) {
      return { action: "reject" };
    }
    return { action: "revoke_family", familyId: stored.familyId };
  }

  if (stored.expiresAt.getTime() <= now.getTime()) return { action: "reject" };

  return { action: "rotate", familyId: stored.familyId };
}
