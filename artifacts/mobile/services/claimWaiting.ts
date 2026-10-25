/**
 * What `app/claim-required.tsx` shows. Pure for the same reason as the rest of
 * the claim rules (see claimCodeGate.ts): the screen cannot be loaded by node.
 */
export interface PendingClaim {
  studentId: string;
  displayName: string;
}

export interface ClaimScreenState {
  mode: 'form' | 'waiting';
  /** The name the account asked for, while waiting. */
  studentName: string;
  /** A request that was waiting is gone and nothing linked: the teacher said no. */
  declined: boolean;
}

export function claimScreenState(pending: readonly PendingClaim[], wasWaiting: boolean): ClaimScreenState {
  const first = pending[0];
  if (first) return { mode: 'waiting', studentName: first.displayName, declined: false };
  return { mode: 'form', studentName: '', declined: wasWaiting };
}

/**
 * What one read of `GET /auth/claim` means. Pure, so the order of the rules is
 * tested: links are looked at BEFORE the pending list.
 *
 * An approved request leaves `pending` exactly as a declined one does, and
 * `claimScreenState([], true)` reads that as «declined». So a read that shows a
 * link is an approval, never a decline, and must be decided first.
 *
 * - `linked`: the account has a link and this caller lets it in.
 * - `ignore`: the account has a link but the caller must not act on it (the
 *   optional join-class screen on arrival: a linked account adding a second
 *   class is not stuck, so a pending claim beside its link is not a waiting
 *   screen). Nothing changes.
 * - `state`: no link; the new pending list, and whether a request has ever been
 *   seen waiting (it stays true once it was, so its disappearance reads as a decline).
 *
 * A read that FAILED is not an input here: the caller keeps its last state, so a
 * network error can never turn a waiting request into a decline.
 */
export type ClaimReadOutcome =
  | { kind: 'linked' }
  | { kind: 'ignore' }
  | { kind: 'state'; pending: PendingClaim[]; wasWaiting: boolean };

export function interpretClaimRead(
  links: readonly unknown[],
  pending: readonly PendingClaim[],
  opts: { wasWaiting: boolean; adoptLinks: boolean },
): ClaimReadOutcome {
  if (links.length > 0) return opts.adoptLinks ? { kind: 'linked' } : { kind: 'ignore' };
  return { kind: 'state', pending: [...pending], wasWaiting: opts.wasWaiting || pending.length > 0 };
}
