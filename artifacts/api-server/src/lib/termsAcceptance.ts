/**
 * The terms-and-privacy acceptance a new account must carry.
 *
 * Until 2026-10-03 the register screen's checkbox gated the password form
 * only — «متابعة عبر Google» ignored it — and the server recorded nothing for
 * either path. Some of these accounts are minors'. A consent nobody can show
 * is not a consent, so both sign-up routes now refuse a new account that did
 * not accept, and store when and which wording.
 *
 * The wording lives in the app (`constants/legal.ts`), so the version is the
 * one the client says it showed — validated as a date-shaped string, because
 * a free-text field in a consent record is a place for nonsense to settle.
 * Same shape as the teacher's roster attestation (`rosterConsentAt` /
 * `rosterConsentVersion`), for the same reason that one gives: a consent
 * record that cannot say what was consented to is close to worthless.
 *
 * Only for **new** accounts. An existing account signing in is not asked
 * again here; re-acceptance after the wording changes is a separate flow.
 */
const VERSION = /^\d{4}-\d{2}-\d{2}(\.[a-z0-9]{1,8})?$/;

export type TermsAcceptance =
  | { ok: true; termsAcceptedAt: Date; termsVersion: string }
  | { ok: false; status: 400; code: "terms_required"; error: string };

export function termsAcceptance(body: unknown, now: Date = new Date()): TermsAcceptance {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  if (b["acceptedTerms"] !== true) {
    return {
      ok: false,
      status: 400,
      code: "terms_required",
      error: "Accept the terms of use and privacy policy to create an account",
    };
  }
  const raw = b["termsVersion"];
  const termsVersion = typeof raw === "string" && VERSION.test(raw) ? raw : "unspecified";
  return { ok: true, termsAcceptedAt: now, termsVersion };
}
