/**
 * Decisions specific to creating an account from a teacher's code alone
 * (`POST /auth/redeem`). Everything about whether the code itself is valid,
 * expired, or already used lives in claimDecision.ts and is not repeated here.
 *
 * No database import, so it is testable — see claimDecision.ts.
 */
import type { ClaimResolution, ClaimRole } from "./claimDecision.ts";

export type RedeemRoleCheck =
  | { ok: true }
  | { ok: false; status: 400; code: "claim_parent_needs_student_code"; error: string };

/**
 * An account made from a code carries no email, no password and no verification,
 * so the code is the only proof of who is asking. A class code cannot carry that
 * for a parent: it is one string for a room, written on a board, and its picker
 * lists every child. Signing in to the existing flow with a class code still
 * works (the account already exists and has an email); minting a brand-new
 * parent from one does not.
 *
 * A student is fine either way. Picking your own name off the class list is how
 * a student has always joined, and the one-account-per-name rule plus the
 * teacher's unlink are the backstop for someone picking another child's.
 */
export function redeemRoleCheck(
  role: ClaimRole,
  resolved: Extract<ClaimResolution, { ok: true }>,
): RedeemRoleCheck {
  if (role === "parent" && resolved.viaClassCode) {
    return {
      ok: false,
      status: 400,
      code: "claim_parent_needs_student_code",
      error: "Ask the teacher for the code written for your child",
    };
  }
  return { ok: true };
}

/**
 * Nobody types a name at code-only signup, but the columns are NOT NULL and a
 * teacher reading a thread needs to know who is writing. A student is their
 * roster name. A parent is «ولي أمر» plus the child's name — "parent of Ahmad"
 * — and edits it later from their profile like any other detail.
 */
export function namesForNewAccount(
  role: ClaimRole,
  rosterName: string,
): { firstName: string; lastName: string } {
  const words = rosterName.trim().split(/\s+/).filter(Boolean);
  if (role === "parent") {
    return { firstName: "ولي أمر", lastName: words.join(" ") };
  }
  return { firstName: words[0] ?? "طالب", lastName: words.slice(1).join(" ") };
}
