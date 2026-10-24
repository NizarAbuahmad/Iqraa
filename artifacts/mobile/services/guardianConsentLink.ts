/**
 * The parent's link is `{origin}/guardian#{token}`: the token is the whole fragment, 43 base64url characters.
 * A fragment never reaches a server, a proxy or an access log; reading it is the page's job and nothing else's.
 * Anything that is not exactly a token answers null, which the page shows as "this link does not work".
 */
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function parseConsentFragment(hash: string | null | undefined): string | null {
  if (typeof hash !== 'string') return null;
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  return TOKEN.test(raw) ? raw : null;
}
