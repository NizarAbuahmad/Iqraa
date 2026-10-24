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
