/**
 * The two answers `POST /auth/claim` can give, as the screens use them. Pure,
 * so the rule "a 202 is a waiting request, not a joined class" is tested.
 */
export type ClaimResult =
  | { status: 'linked'; studentId: string; relation: 'self' | 'guardian' }
  | { status: 'pending'; studentId: string; studentName: string };

export function parseClaimResponse(body: unknown): ClaimResult {
  const b = (body ?? {}) as { pending?: unknown; studentId?: unknown; relation?: unknown; studentName?: unknown };
  const studentId = typeof b.studentId === 'string' ? b.studentId : '';
  if (b.pending === true) {
    return { status: 'pending', studentId, studentName: typeof b.studentName === 'string' ? b.studentName : '' };
  }
  return { status: 'linked', studentId, relation: b.relation === 'guardian' ? 'guardian' : 'self' };
}
