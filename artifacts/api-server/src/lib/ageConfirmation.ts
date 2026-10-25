/**
 * The age / guardian confirmation a student who signs up with an email must carry.
 *
 * A student used to arrive only through a teacher's code, which is a person
 * vouching for them. Since 2026-10-23 a student may register with an email and
 * no code, so nobody has, and many students are minors. The register screen
 * asks them to confirm they are an adult or have a guardian's agreement, and
 * both sign-up routes (`/register`, `/google`) refuse a new student account
 * that did not. When and that they did is stored on the user
 * (`guardianConfirmedAt`), next to the terms acceptance.
 *
 * Only a **student** is asked. A teacher is an adult by the terms; a parent and
 * a code-only student come in through a teacher's code (`/auth/redeem`).
 * A literal `true` only: a string or a number in a consent field is nonsense.
 */
export type AgeConfirmation =
  | { ok: true; guardianConfirmedAt: Date | null }
  | { ok: false; status: 400; code: "age_confirmation_required"; error: string };

export function ageConfirmation(body: unknown, role: string, now: Date = new Date()): AgeConfirmation {
  if (role !== "student") return { ok: true, guardianConfirmedAt: null };
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  if (b["ageConfirmed"] !== true) {
    return {
      ok: false,
      status: 400,
      code: "age_confirmation_required",
      error: "Confirm you are an adult, or that a parent or guardian agrees, to create a student account",
    };
  }
  return { ok: true, guardianConfirmedAt: now };
}
