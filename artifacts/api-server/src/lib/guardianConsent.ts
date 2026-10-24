// artifacts/api-server/src/lib/guardianConsent.ts
/**
 * The rules of a parent's approval that need no database: the address, the token, the limits.
 *
 * The token is 32 random bytes, base64url (43 characters). Only its sha256 is ever stored, so the plaintext exists
 * for exactly as long as it takes to put it in the mail. Random and that long, so a plain sha256 is right (the
 * reasoning `loginCode.ts` gives).
 */
import crypto from "node:crypto";
import { isValidEmailAddress } from "./emailAddress.ts";

export const DAY_MS = 24 * 60 * 60 * 1000;
/** A link works for seven days from the moment it is mailed. */
export const CONSENT_TTL_MS = 7 * DAY_MS;
export const GUARDIAN_LIMITS = { perStudentPerDay: 3, perParentPerDay: 5 } as const;

export type ParentEmailResult =
  | { ok: true; email: string }
  | {
      ok: false;
      status: 400;
      code: "parent_email_required" | "parent_email_invalid" | "parent_email_is_own";
      error: string;
    };

const refuse = (
  code: "parent_email_required" | "parent_email_invalid" | "parent_email_is_own",
  error: string,
): ParentEmailResult => ({ ok: false, status: 400, code, error });

/** Trimmed and lower-cased like every address here, and never the student's own. */
export function normalizeParentEmail(raw: unknown, ownEmail: string | null): ParentEmailResult {
  if (raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "")) {
    return refuse("parent_email_required", "A parent's email is required");
  }
  if (!isValidEmailAddress(raw)) {
    return refuse("parent_email_invalid", "That does not look like an email address");
  }
  const email = raw.toLowerCase().trim();
  if (ownEmail !== null && email === ownEmail.toLowerCase().trim()) {
    return refuse("parent_email_is_own", "Enter a parent's email, not your own");
  }
  return { ok: true, email };
}

export function generateConsentToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashConsentToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Shape check only, so a junk value never becomes a query. */
export function looksLikeConsentToken(t: unknown): t is string {
  return typeof t === "string" && /^[A-Za-z0-9_-]{43}$/.test(t);
}

/** `parent@gmail.com` → `pa***@gmail.com`; a one- or two-character local part keeps one character. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "***";
  const local = email.slice(0, at);
  const keep = local.length > 2 ? 2 : 1;
  return `${local.slice(0, keep)}***${email.slice(at)}`;
}

export function limitReached(count: number, max: number): boolean {
  return count >= max;
}
