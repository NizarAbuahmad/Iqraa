/**
 * The parent's page as a small state machine, kept free of React so `node --test` can pin it. The page reads a
 * lookup result or a decide error and asks these functions what to show next; nothing here sees the token.
 *
 * Rule of thumb for a parent: an outcome that will not change by trying again (used, expired, switched off) is a
 * closed page; only a failure to reach the server is "try again".
 */
import type { ConsentLookup } from './guardianApi.ts';

export type ConsentDecision = 'approved' | 'declined';

export type ConsentView =
  | { kind: 'loading' }
  | { kind: 'browser' }                                              // native: the link is meant for a browser
  | { kind: 'retry' }                                                // could not reach the server
  | { kind: 'open'; childFirstName: string }                         // waiting for the parent's decision
  | { kind: 'closed'; reason: 'expired' | 'decided' | 'invalid' }    // nothing more to do on this link
  | { kind: 'done'; decision: ConsentDecision };

/** Web starts by looking the link up; native makes no call at all. */
export function initialView(isWeb: boolean): ConsentView {
  return isWeb ? { kind: 'loading' } : { kind: 'browser' };
}

/** A link with no well-formed token is the same page as a link the server does not know. */
export function viewForMissingToken(): ConsentView {
  return { kind: 'closed', reason: 'invalid' };
}

export function viewForLookup(result: ConsentLookup): ConsentView {
  return result.status === 'open' ? { kind: 'open', childFirstName: result.childFirstName } : { kind: 'closed', reason: result.status };
}

/** `guardianApi.lookup` threw: network, rate limit or a server error. */
export function viewForLookupFailure(): ConsentView {
  return { kind: 'retry' };
}

export function viewForDecision(decision: ConsentDecision): ConsentView {
  return { kind: 'done', decision };
}

/** Approving needs the parent's tick first; declining never does. */
export function needsConfirmFirst(decision: ConsentDecision, confirmed: boolean): boolean {
  return decision === 'approved' && !confirmed;
}

export type DecideOutcome =
  | { next: 'reload' }                               // 404/410: look the link up again and show what it is now
  | { next: 'warn'; warn: 'confirmFirst' | 'retry' };

/** What a thrown `decide` means. Anything that is not clearly a closed link or a missing tick is "try again". */
export function outcomeForDecideError(error: unknown): DecideOutcome {
  const e = error as { name?: unknown; status?: unknown; code?: unknown } | null;
  const isApiError = !!e && typeof e === 'object' && e.name === 'GuardianApiError';
  if (isApiError && (e!.status === 410 || e!.status === 404)) return { next: 'reload' };
  if (isApiError && e!.code === 'guardian_confirmation_required') return { next: 'warn', warn: 'confirmFirst' };
  return { next: 'warn', warn: 'retry' };
}

/** The i18n key for a closed page. */
export function closedCopyKey(reason: 'expired' | 'decided' | 'invalid'): 'parentConsentExpired' | 'parentConsentDecided' | 'parentConsentInvalid' {
  return reason === 'expired' ? 'parentConsentExpired' : reason === 'decided' ? 'parentConsentDecided' : 'parentConsentInvalid';
}
