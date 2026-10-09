/**
 * Whether a Google ID token proves a fresh sign-in by the owner of a
 * password-less account, for `DELETE /auth/users/me`.
 *
 * Split out of `routes/auth.ts` for the usual reason (it imports
 * `@workspace/db`, which throws under `node --test`).
 *
 * A Google-only account used to confirm deletion by retyping its email — which
 * is inside the access token's own claims, so a stolen access token was all it
 * took to erase the account and, for a teacher, the whole roster. Now the app
 * runs Google sign-in again and sends the ID token it gets back. The route has
 * already checked the signature and audience with the same verifier
 * `/auth/google` uses; this decides the rest:
 *
 *   - `sub` is the Google account linked to this row, not just any Google user.
 *   - `iat` is recent. A token is valid for an hour, and one lifted from an
 *     earlier sign-in must not count as "just now".
 *
 * `iat`, not `auth_time`: the native SDK re-signs in against the Google session
 * already on the phone without a password prompt, so `auth_time` (when Google
 * last saw a password) can be weeks old on a perfectly fresh sign-in.
 */

/** How old the ID token may be. Long enough to read a confirm dialog. */
export const GOOGLE_REAUTH_MAX_AGE_S = 5 * 60;

/** Clock skew tolerated for an `iat` slightly in the future. */
const FUTURE_SKEW_S = 60;

export type GoogleReauthResult = "ok" | "wrong_account" | "stale";

export function checkGoogleReauth(
  payload: { sub?: string; iat?: number } | undefined,
  linkedGoogleId: string | null,
  nowMs: number,
): GoogleReauthResult {
  if (!payload?.sub || !linkedGoogleId || payload.sub !== linkedGoogleId) return "wrong_account";
  if (typeof payload.iat !== "number") return "stale";
  const ageS = nowMs / 1000 - payload.iat;
  if (ageS > GOOGLE_REAUTH_MAX_AGE_S || ageS < -FUTURE_SKEW_S) return "stale";
  return "ok";
}
