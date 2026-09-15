/**
 * What happens to an existing account when Google sign-in attaches to it.
 *
 * Split out of `routes/auth.ts` for the same reason as `claimDecision.ts` and
 * `suspension.ts`: that file imports `@workspace/db` at module scope, which
 * throws without a DATABASE_URL, so nothing declared inside it can be reached
 * by `node --test`. The rule is worth testing on its own, because getting it
 * wrong is silent in both directions and one of those directions is an
 * account takeover.
 *
 * The rule
 * --------
 * `POST /register` writes a row with `emailVerified: false`, whatever password
 * was typed, and hands back no session. Anyone can therefore pre-create an
 * account on an address they do not own, and it sits there looking harmless
 * because `/login` refuses an unverified row.
 *
 * Google sign-in on that same address is what ends the harmlessness: it finds
 * the row by email and marks it verified, and the password the pre-creator
 * chose is suddenly a working credential on an account that now belongs to
 * someone else. The registration rate limits never see this — the whole attack
 * is one request, weeks earlier.
 *
 * So: a row that had not proved its own address does not keep its password
 * through the link. The account survives, the sign-in works, and
 * `/auth/forgot-password` will set a real password later — that route mails
 * the address, which by then is proven.
 *
 * A row that was already verified keeps everything. Both factors proved the
 * same address; there is nothing to distrust.
 */

export interface GoogleLinkDecision {
  /** Fields to set on the existing row. */
  update: { googleId: string; emailVerified: true; passwordHash?: null };
  /**
   * Whether the pre-link credentials have to be torn down too: refresh tokens
   * revoked and unused verification codes burned. True exactly when the row
   * was unverified — those artefacts were minted on behalf of whoever created
   * it, not the person Google just authenticated.
   */
  revokeExistingCredentials: boolean;
}

export function decideGoogleLink(
  existing: { emailVerified: boolean | null },
  googleSub: string,
): GoogleLinkDecision {
  // `null` counts as unverified. The column is NOT NULL today, but reading a
  // missing answer as "verified" is the direction that fails open.
  const wasUnverified = existing.emailVerified !== true;
  return {
    update: {
      googleId: googleSub,
      emailVerified: true,
      ...(wasUnverified ? { passwordHash: null } : {}),
    },
    revokeExistingCredentials: wasUnverified,
  };
}
