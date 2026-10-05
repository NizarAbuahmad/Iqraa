/**
 * When is a signed-in screen actually signed out?
 *
 * Kept free of react-native imports so the rules can be tested under node.
 *
 * Two ways a tab ends up holding a user object with no tokens behind it:
 *   - another tab on the same origin signed out or added an account, which
 *     clears the shared localStorage tokens (web only);
 *   - an old build or a failed write left the user without a refresh token.
 * Either way every request 401s and nothing ever asks the user to sign in
 * again, because the refresh path only reports failure once it has *tried* a
 * refresh token.
 */
export const ACCESS_TOKEN_KEY = 'iqra_access_token';
export const REFRESH_TOKEN_KEY = 'iqra_refresh_token';

/**
 * A 401 with no refresh token to try means the session is gone. `/auth/*` is
 * excluded: a wrong password or a bad code is a 401 too, and says nothing
 * about the session.
 */
export function isSessionLost(path: string, hadRefreshToken: boolean): boolean {
  return !hadRefreshToken && !path.startsWith('/auth/');
}

/**
 * A `storage` event (fired in the *other* tabs only) that removed a token.
 * `key === null` is `localStorage.clear()`. Writes are ignored: a token
 * refreshed by another tab is not a sign-out.
 */
export function isTokenRemovedByOtherTab(e: { key: string | null; newValue: string | null }): boolean {
  if (e.key === null) return true;
  return (e.key === ACCESS_TOKEN_KEY || e.key === REFRESH_TOKEN_KEY) && e.newValue === null;
}
