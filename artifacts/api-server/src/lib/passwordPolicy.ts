// At least 8 characters with a letter and a digit — blocks the weakest
// passwords (all-digit, dictionary words) without demanding a symbol, which
// would just push pilot teachers toward writing passwords down.
const STRONG_PASSWORD = /(?=.*\p{L})(?=.*\d).{8,}/u;

/**
 * An upper bound, which bcrypt makes necessary whether or not anyone asks for
 * one.
 *
 * bcrypt hashes the first 72 bytes and silently ignores the rest, so without
 * a cap a 200-character passphrase and its first 72 characters are the same
 * password — and the person who chose the long one has no way to know. The
 * body parser accepts 12MB, so the input is otherwise unbounded, and every
 * byte of it is UTF-8 encoded before bcryptjs gets to the part it discards.
 *
 * 128, not 72: the truncation point is a bcrypt implementation detail and
 * moving the limit to it would reject passwords that work today. This is a
 * sanity bound, not a statement about where the entropy stops counting.
 *
 * Deliberately enforced only where a password is *set* — register, reset,
 * admin-set. `/auth/login` compares with bcrypt directly and never calls this,
 * which is what it must keep doing: a cap applied at sign-in would lock out
 * anyone who set a longer password before this existed.
 */
export const MAX_PASSWORD_LENGTH = 128;

export const PASSWORD_POLICY_MESSAGE =
  "Password must be at least 8 characters, at most 128, and include both a letter and a number";

export function isStrongPassword(password: string): boolean {
  if (password.length > MAX_PASSWORD_LENGTH) return false;
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
