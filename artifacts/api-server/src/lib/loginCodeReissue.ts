/**
 * Whether a teacher may reissue an account's login code.
 *
 * Only for an account whose way in IS the code. A Google account and one that
 * never had a code are refused. So is one with a **verified** email and a
 * password: it can reset its own.
 *
 * What changed (2026-10-23): a password alone no longer closes this. A
 * code-only student can add an email and password later (`/auth/add-email`),
 * but the address starts unverified and `/auth/login` needs a verified one, so
 * until the 6-digit code is entered the login code is the only door. A student
 * who mistyped the address and then lost the code was locked out of both, and
 * the teacher's button answered `not_a_code_account`.
 */
export function canReissueLoginCode(target: {
  loginCodeHash: string | null;
  passwordHash: string | null;
  googleId: string | null;
  emailVerified: boolean;
}): boolean {
  if (!target.loginCodeHash || target.googleId) return false;
  if (target.passwordHash && target.emailVerified) return false;
  return true;
}
