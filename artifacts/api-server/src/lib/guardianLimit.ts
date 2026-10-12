/**
 * How many parent accounts one child may have.
 *
 * A per-student claim code is not single-use on purpose: a second guardian is
 * added with the same code (see claimDecision.ts). That was bounded by the cost
 * of an email account per guardian until sign-up could be done from a code
 * alone — now anyone holding a child's code can mint a guardian account for
 * free, and every guardian reads that child's messages. This is the ceiling.
 *
 * Four is two parents plus two more relatives, which is a real family. The
 * teacher can unlink one from the linked-accounts list to make room, so a
 * legitimate fifth is a one-tap fix, not a dead end.
 *
 * No database import, so it is testable — see claimDecision.ts.
 */
export const MAX_GUARDIANS_PER_STUDENT = 4;

/**
 * `otherGuardians` is the number of guardian links held by accounts OTHER than
 * the caller. Counting the caller's own would refuse a parent re-sending a claim
 * they already made for taking a seat they already hold.
 */
export function guardianLimitReached(otherGuardians: number): boolean {
  return otherGuardians >= MAX_GUARDIANS_PER_STUDENT;
}
