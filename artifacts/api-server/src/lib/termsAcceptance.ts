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
 * New accounts are checked at sign-up, here. An account that already exists
 * is asked again when the wording changes, or when it has no record at all
 * (`termsReacceptance`, below) — owner decision, 2026-10-05.
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

/**
 * A stored version as something comparable. The column also holds
 * "unspecified" (sign-up sent a malformed version) and "" (an account from
 * before 2026-10-03); neither names a wording anyone saw, and "unspecified"
 * would sort *after* every date, so both rank as "no acceptance".
 */
export function termsVersionRank(stored: string | null | undefined): string {
  return typeof stored === "string" && VERSION.test(stored) ? stored : "";
}

/**
 * Dates sort as strings, so `"2026-09-06" < "2026-10-05"` and a suffixed
 * revision (`"2026-10-05.b"`) sorts after its bare date. An account with no
 * ranked version is behind every version.
 */
export function isBehindTerms(stored: string | null | undefined, current: string): boolean {
  return termsVersionRank(stored) < current;
}

export type TermsReacceptance =
  | { ok: true; changed: false }
  | { ok: true; changed: true; termsAcceptedAt: Date; termsVersion: string }
  | { ok: false; status: 400; code: "invalid_terms_version"; error: string };

/**
 * Whether `POST /auth/accept-terms` records this version for an account that
 * already holds `stored`.
 *
 * - The version must be one a client could have shown: date-shaped, and not
 *   later than tomorrow (UTC) — a future date would put a wording that does
 *   not exist yet on someone's consent record.
 * - It must not be older than what the account already accepted. An outdated
 *   client re-sending its own, older `LEGAL_VERSION` is told "nothing to do"
 *   rather than moving the record backwards.
 * - The same version twice changes nothing and keeps the first timestamp: the
 *   record says when they accepted that wording, not when they last tapped.
 */
export function termsReacceptance(
  body: unknown,
  stored: string | null | undefined,
  now: Date = new Date(),
): TermsReacceptance {
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>)["termsVersion"] : undefined;
  if (typeof raw !== "string" || !VERSION.test(raw)) {
    return { ok: false, status: 400, code: "invalid_terms_version", error: "termsVersion must be a date such as 2026-10-05" };
  }
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (raw.slice(0, 10) > horizon) {
    return { ok: false, status: 400, code: "invalid_terms_version", error: "termsVersion is in the future" };
  }
  if (raw <= termsVersionRank(stored)) return { ok: true, changed: false };
  return { ok: true, changed: true, termsAcceptedAt: now, termsVersion: raw };
}
