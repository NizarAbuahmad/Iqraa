/**
 * The two pure decisions behind a claim code: what a typed code resolves to,
 * and whether a code is still live.
 *
 * Split out of `rosterClaim.ts` for one reason: that file imports
 * `@workspace/db`, and `node --test` cannot resolve its directory import, so
 * anything living beside it is untestable. The same trap CLAUDE.md records for
 * the OpenAI client at module scope, and the same fix `services/messageMerge.ts`
 * used on the client side.
 *
 * Both are shared by the redeem path (`lib/rosterClaim.ts`) and the teacher's
 * read endpoint (`routes/roster.ts`). One definition each, so a screen cannot
 * display a code the resolver would refuse.
 */
import { normalizeShareCode } from "../modules/assessment/studentView.ts";

/**
 * What a typed or pasted code should be looked up as, or `null` when there is
 * nothing left to look up.
 *
 * Claim codes were compared verbatim — both call sites only trimmed — so a
 * parent pasting «abc-234 » was told the code was invalid or expired, which
 * was neither true nor actionable. Exam codes have always been normalised;
 * this closes the gap and does it once, where every caller passes.
 */
export function claimCodeLookupKey(raw: unknown): string | null {
  const normalized = normalizeShareCode(raw);
  return normalized === "" ? null : normalized;
}

/** Whether a claim code is still redeemable. */
export function claimCodeIsLive(expiresAt: Date | null | undefined): boolean {
  return !!expiresAt && expiresAt > new Date();
}
