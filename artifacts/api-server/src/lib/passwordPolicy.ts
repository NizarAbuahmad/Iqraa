// At least 8 characters with a letter and a digit — blocks the weakest
// passwords (all-digit, dictionary words) without demanding a symbol, which
// would just push pilot teachers toward writing passwords down.
const STRONG_PASSWORD = /(?=.*\p{L})(?=.*\d).{8,}/u;

export const PASSWORD_POLICY_MESSAGE =
  "Password must be at least 8 characters and include both a letter and a number";

export function isStrongPassword(password: string): boolean {
  return STRONG_PASSWORD.test(password);
}

/**
 * Who may set someone else's password.
 *
 * `system_admin` only, and never onto another admin account — which, since the
 * actor is always an admin, also means never onto themselves.
 *
 * This exists because removing password reset on 2026-09-10 left an
 * email+password account on a non-Google address with no way back in (see
 * STATUS.md). It is a way to help a locked-out teacher, not a way to acquire
 * an admin account: without the second check, one compromised admin token
 * takes over every other admin. `school_admin` is excluded from calling it for
 * the same reason it is excluded from being a target — the admin roles are set
 * by hand in the database, so an admin who is locked out is already in reach
 * of the only tool they need.
 */
export function canAdminSetPassword(
  actorRole: string,
  target: { role: string },
): boolean {
  if (actorRole !== "system_admin") return false;
  return target.role !== "system_admin" && target.role !== "school_admin";
}
