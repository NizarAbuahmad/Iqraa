/**
 * Which Google OAuth client IDs an ID token may be minted for.
 *
 * Split out of `routes/auth.ts` so it can be unit-tested: that file imports
 * `@workspace/db`, which throws at module scope without a DATABASE_URL, so
 * nothing in it can be loaded by `node --test`. Same reason `lib/suspension.ts`
 * exists.
 *
 * Why a list at all. Google's `verifyIdToken` checks that the token's `aud`
 * claim matches, and a token minted by an Android client carries the Android
 * client's ID — not the web one. Web sign-in has always used a single client,
 * so the moment native sign-in arrives there are two, and during the move to
 * the Firebase project `iqraa-95dd1` there are two *projects* in play as well.
 *
 * A single value swapped over would reject every token from the old client the
 * instant it changed — i.e. sign out every existing web user, with the failure
 * indistinguishable from a bad token. Accepting a list makes the migration
 * something you can verify one side at a time.
 *
 * `GOOGLE_CLIENT_IDS` wins when it yields anything; otherwise the long-standing
 * `GOOGLE_CLIENT_ID` is used, so a deployment that never sets the new variable
 * behaves exactly as before.
 */

/** Trimmed, de-duplicated, empties dropped. Order is preserved. */
function split(raw: string | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (id) seen.add(id);
  }
  return [...seen];
}

/**
 * @param many  `GOOGLE_CLIENT_IDS` — comma-separated, the migration-friendly form.
 * @param one   `GOOGLE_CLIENT_ID` — the original single value.
 * @returns every acceptable audience; empty means Google sign-in is unconfigured.
 */
export function parseGoogleClientIds(
  many: string | undefined,
  one: string | undefined,
): string[] {
  const list = split(many);
  return list.length > 0 ? list : split(one);
}

/** Reads the environment at call time, so a test can set either variable. */
export function googleClientIds(): string[] {
  return parseGoogleClientIds(process.env.GOOGLE_CLIENT_IDS, process.env.GOOGLE_CLIENT_ID);
}
