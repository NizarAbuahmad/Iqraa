/**
 * The personal login code of a parent or student who signed up with a teacher's
 * code and no email.
 *
 * Why a second code at all, when the teacher already handed over one: the
 * teacher's code is not a credential. A class code is one string for thirty
 * families (and is on a whiteboard), neither kind is single-use, and both
 * expire — so "sign in with the code you signed up with" would let anyone who
 * ever saw it take the account over, and lock the real owner out in 30 days.
 *
 * So signing up mints this one, shows it once, and keeps only its hash. It is
 * 12 characters from the same unambiguous alphabet as the teacher's codes
 * (31^12 ≈ 7.9e17): long enough that, unlike a 6-character code, nobody can
 * walk the space, which matters because it is the account's only credential
 * and is looked up with no other identifier alongside it. Because it is random
 * and that long, a plain sha256 is the right hash — the same reasoning as the
 * refresh tokens; bcrypt would only slow every sign-in for no gain.
 *
 * No database import, so it is testable (see claimDecision.ts for why that
 * matters in this repo).
 */
import crypto from "node:crypto";
import { SHARE_CODE_ALPHABET } from "./shareCodeAlphabet.ts";

export const LOGIN_CODE_LENGTH = 12;

/** `ABCD-EFGH-JKMN` — grouped for reading aloud and copying off a screen. */
export function generateLoginCode(): string {
  const chars = Array.from(
    { length: LOGIN_CODE_LENGTH },
    () => SHARE_CODE_ALPHABET[crypto.randomInt(SHARE_CODE_ALPHABET.length)],
  );
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12)].map(g => g.join("")).join("-");
}

/**
 * What a person typed, reduced to the 12 characters, or null if it cannot be a
 * login code. Strict on length where `normalizeShareCode` is not: a
 * teacher-length code pasted into this field must read as "not a login code",
 * not as a short one that nearly matches.
 */
export function normalizeLoginCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const upper = raw.toUpperCase();
  // Separators a person types are fine; any other character means this is not
  // the code, and silently dropping it would turn `…EFG0` into a different,
  // valid-looking code.
  if (/[^A-Z0-9\s-]/.test(upper)) return null;
  const kept = upper.replace(/[\s-]/g, "");
  if (kept.length !== LOGIN_CODE_LENGTH) return null;
  for (const c of kept) if (!SHARE_CODE_ALPHABET.includes(c)) return null;
  return kept;
}

export function hashLoginCode(raw: unknown): string | null {
  const code = normalizeLoginCode(raw);
  return code ? crypto.createHash("sha256").update(code).digest("hex") : null;
}
