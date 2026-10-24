/**
 * The app's side of the server's parent-approval answer. No imports on purpose: `node --test` loads this file.
 *
 * `/auth/me` is the only place the server reports `guardianStatus` (the sign-in answers do not carry it), so an
 * account the app has just signed in has no status until `AuthContext.refreshUser()` reads `/me`. Unknown or
 * missing means "not held": the server is the enforcer, and the first 403 `guardian_approval_required` makes
 * the app re-read `/me`.
 */
export type GuardianStatus = 'not_required' | 'approved' | 'needed' | 'waiting' | 'declined';

const STATUSES: readonly string[] = ['not_required', 'approved', 'needed', 'waiting', 'declined'];

export interface GuardianUserLike {
  role?: string | null;
  guardianStatus?: GuardianStatus | null;
}

/** The two fields the app keeps from `/auth/me`, or `{}` when the server sent nothing usable. */
export function guardianFromApi(api: { guardianStatus?: unknown; guardianParentEmailMasked?: unknown }): {
  guardianStatus?: GuardianStatus;
  guardianParentEmailMasked?: string;
} {
  const out: { guardianStatus?: GuardianStatus; guardianParentEmailMasked?: string } = {};
  if (typeof api.guardianStatus === 'string' && STATUSES.includes(api.guardianStatus)) {
    out.guardianStatus = api.guardianStatus as GuardianStatus;
    if (typeof api.guardianParentEmailMasked === 'string') out.guardianParentEmailMasked = api.guardianParentEmailMasked;
  }
  return out;
}

/** True when a 403 body is the server holding a student for a parent's approval. Never throws. */
export function isGuardianRequiredBody(text: string): boolean {
  try {
    const body = JSON.parse(text);
    return !!body && typeof body === 'object' && (body as { code?: unknown }).code === 'guardian_approval_required';
  } catch {
    return false;
  }
}

/** A convenience check for the parent's-email field; the server's validation is the real one. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
