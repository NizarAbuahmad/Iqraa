/**
 * What a new student account owes at sign-up, in one place for `/register` and `/google`: with `GUARDIAN_APPROVAL`
 * on, a parent's address (checked, and capped per address per day); with it off, the age tick
 * (`lib/ageConfirmation.ts`). Anyone who is not a student owes neither.
 *
 * No database and no logger on purpose, so `node --test` can load it: the per-address count and the tick rule are
 * passed in by the caller.
 */
import { GUARDIAN_LIMITS, limitReached, normalizeParentEmail } from "./guardianConsent.ts";
import type { AgeConfirmation } from "./ageConfirmation.ts";

export interface GuardianSignupInput {
  flagOn: boolean;
  role: string;
  body: unknown;
  /** The address the student is signing up with, so it cannot also be the parent's. */
  studentEmail: string;
  countForParent: (parentEmail: string) => Promise<number>;
  ageConfirmation: (body: unknown, role: string) => AgeConfirmation;
}

export type GuardianSignupResult =
  | { ok: true; parentEmail: string | null; guardianConfirmedAt: Date | null }
  | { ok: false; status: number; body: { error: string; code: string } };

export async function guardianSignup(input: GuardianSignupInput): Promise<GuardianSignupResult> {
  if (input.flagOn && input.role === "student") {
    const raw = input.body && typeof input.body === "object" ? (input.body as { parentEmail?: unknown }).parentEmail : undefined;
    const parent = normalizeParentEmail(raw, input.studentEmail);
    if (!parent.ok) return { ok: false, status: parent.status, body: { error: parent.error, code: parent.code } };
    if (limitReached(await input.countForParent(parent.email), GUARDIAN_LIMITS.perParentPerDay)) {
      return {
        ok: false,
        status: 429,
        body: { error: "Too many requests for that address. Try again tomorrow.", code: "guardian_rate_limited" },
      };
    }
    // A parent's approval stands in for the tick, so no tick is recorded.
    return { ok: true, parentEmail: parent.email, guardianConfirmedAt: null };
  }
  const age = input.ageConfirmation(input.body, input.role);
  if (!age.ok) return { ok: false, status: age.status, body: { error: age.error, code: age.code } };
  return { ok: true, parentEmail: null, guardianConfirmedAt: age.guardianConfirmedAt };
}
