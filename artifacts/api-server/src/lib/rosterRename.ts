/**
 * The rules for renaming a roster row, with no database attached — the same
 * split as claimDecision.ts, for the same reason: importing `@workspace/db`
 * needs a live Postgres, and these rules decide whether a person's own name is
 * overwritten.
 */
import type { ClaimRelation, ClaimRole } from "./claimDecision.ts";
import { namesForNewAccount } from "./redeemPolicy.ts";

/**
 * Whitespace-normalised, case-folded. Deliberately does not fold Arabic
 * orthography (أ/ا, ة/ه): merging two people who share a spelling is a worse
 * failure than allowing a near-duplicate, and it cannot be undone from the UI.
 */
export function nameKey(name: string): string {
  return name.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Whether `candidate` is already the name of one of `peers`. */
export function nameTakenBy(candidate: string, peers: readonly string[]): boolean {
  const key = nameKey(candidate);
  return peers.some(peer => nameKey(peer) === key);
}

const ROLE_OF: Record<ClaimRelation, ClaimRole> = { self: "student", guardian: "parent" };

/**
 * The new first/last name for a linked code-only account after its roster row
 * was renamed, or null when it should be left as it is.
 *
 * Null when the account's current name is not what `oldRosterName` would have
 * produced — the person edited it, and it is theirs now — and when the rename
 * does not change the derived name at all.
 */
export function renamedAccountNames(input: {
  relation: ClaimRelation;
  oldRosterName: string;
  newRosterName: string;
  current: { firstName: string; lastName: string };
}): { firstName: string; lastName: string } | null {
  const role = ROLE_OF[input.relation];
  const before = namesForNewAccount(role, input.oldRosterName);
  if (input.current.firstName !== before.firstName || input.current.lastName !== before.lastName) {
    return null;
  }
  const after = namesForNewAccount(role, input.newRosterName);
  if (after.firstName === before.firstName && after.lastName === before.lastName) return null;
  return after;
}
