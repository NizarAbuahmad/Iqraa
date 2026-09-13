import crypto from "crypto";
import { generateVerificationCode } from "./emailVerification.ts";

/**
 * Same 6-digit shape as email verification, deliberately.
 *
 * The flow this replaces used a 32-byte hex token meant to ride in a link.
 * Nothing in this app opens a link into a reset screen, and nobody types
 * sixty-four hex characters on a phone — so a teacher resetting a password
 * now reads the same kind of code, from the same kind of email, as one
 * verifying an address. One code format in the product, not two.
 */
export const generateResetCode = generateVerificationCode;

/**
 * Scoped to the user, unlike the email-verification hash.
 *
 * `password_reset_tokens.token_hash` carries a UNIQUE constraint, and a
 * 6-digit code is only 1e6 possibilities. Two people with a reset open at the
 * same time will eventually draw the same code, and the second insert would
 * then fail on that constraint — a collision between strangers, surfacing as
 * "reset is broken" for whoever came second. Mixing the user id in makes every
 * row distinct whatever was drawn, and has the useful side effect that a code
 * is only ever valid for the account it was sent to.
 */
export function hashResetCode(userId: string, code: string): string {
  return crypto.createHash("sha256").update(`${userId}:${code}`).digest("hex");
}

/** Matches VERIFICATION_CODE_TTL_MS — the two emails should not age differently. */
export const RESET_CODE_TTL_MS = 15 * 60 * 1000;
