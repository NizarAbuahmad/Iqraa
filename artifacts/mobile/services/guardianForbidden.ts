/**
 * What `apiFetch` does with a 403: when the server says `guardian_approval_required`, tell the app so it can
 * re-read /auth/me and let the root layout move the held student to the waiting screen. Split out of
 * `apiClient.ts` (which imports react-native storage) so the rules run under bare `node --test`.
 */
import { isGuardianRequiredBody } from './guardianApproval.ts';

/**
 * Looks at a response without consuming it. Fire and forget: nothing waits on this, and it never throws.
 *
 * It reads a clone, so the caller can still read the real body. `clone()` throws on a transport that cannot
 * (Expo's native fetch, used for the chat stream, answers "Not implemented"), and that must never turn a 403
 * into a rejected call: the caller still reads the real answer. With no callback registered, nothing is cloned.
 */
export function noteGuardianForbidden(
  res: { status: number; clone: () => { text: () => Promise<string> } },
  onRequired: (() => void) | null,
): void {
  if (res.status !== 403 || !onRequired) return;
  try {
    void res.clone().text().then(text => {
      if (isGuardianRequiredBody(text)) onRequired();
    }).catch(() => {});
  } catch {
    // The next call over a transport that can clone will report it.
  }
}
