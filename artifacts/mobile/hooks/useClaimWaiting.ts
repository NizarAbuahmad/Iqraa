import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { getMyRosterClaims, unclaimRoster } from '@/services/roster';
import { claimScreenState, type PendingClaim } from '@/services/claimWaiting';

/**
 * The waiting-for-the-teacher state of a class-code claim, shared by the two
 * screens that can hold one: `app/claim-required.tsx` and `app/join-class.tsx`
 * (a student is no longer gated onto the first, so the second is where most
 * of them see it). A class-code pick by a student is held by the server
 * (api-server `lib/claimDecision.ts`); this hook reads what is held, looks
 * again on request, and withdraws the request so another name can be picked.
 *
 * Order matters in `refresh`: links are read BEFORE pending. A request that
 * was waiting and is now gone reads as declined (`claimScreenState`), and an
 * approved one is gone from `pending` too, so an approval read the other way
 * round would show «your teacher did not approve». And a failed read changes
 * nothing, for the same reason: it must never look like a decline.
 *
 * `adoptLinksOnMount`: claim-required is mandatory, so an account that already
 * has a link on arrival is let in. join-class is optional and is also how a
 * linked account adds a second class, so there a link on arrival means "show
 * the form as usual" — and a pending claim beside a link is not the waiting
 * screen, because that account is not stuck.
 */
export type ClaimRefresh = 'linked' | 'waiting' | 'none' | 'failed';

export function useClaimWaiting(opts: { onLinked: () => void; adoptLinksOnMount: boolean }) {
  const { t } = useLanguage();
  const [pending, setPending] = useState<PendingClaim[]>([]);
  const [wasWaiting, setWasWaiting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const screen = claimScreenState(pending, wasWaiting);

  // The caller's callback changes every render; the mount effect must not re-run for it.
  const onLinkedRef = useRef(opts.onLinked);
  onLinkedRef.current = opts.onLinked;

  const refresh = useCallback(async (mount: boolean): Promise<ClaimRefresh> => {
    try {
      const { links, pending: waiting } = await getMyRosterClaims();
      if (links.length > 0) {
        if (!mount || opts.adoptLinksOnMount) {
          onLinkedRef.current();
          return 'linked';
        }
        // join-class, already linked: an ordinary form, whatever else is pending.
        return 'none';
      }
      setPending(waiting);
      if (waiting.length > 0) setWasWaiting(true);
      return waiting.length > 0 ? 'waiting' : 'none';
    } catch {
      return 'failed';
    }
  }, [opts.adoptLinksOnMount]);

  // An account that asked earlier (another session, or after signing in again) opens straight on the waiting card.
  useEffect(() => { void refresh(true); }, [refresh]);

  /** A claim the screen just submitted came back held. */
  const hold = useCallback((claim: PendingClaim) => {
    setPending([claim]);
    setWasWaiting(true);
    setError('');
  }, []);

  const check = useCallback(async () => {
    setChecking(true);
    setError('');
    const state = await refresh(false);
    if (state === 'waiting') setError(t('claimWaitingStill'));
    else if (state === 'failed') setError(t('joinAnotherClassFailed'));
    setChecking(false);
  }, [refresh, t]);

  const change = useCallback(async () => {
    setChecking(true);
    setError('');
    try {
      await unclaimRoster();
      setPending([]);
      setWasWaiting(false);
    } catch {
      setError(t('joinAnotherClassFailed'));
    } finally {
      setChecking(false);
    }
  }, [t]);

  return { screen, checking, error, hold, check, change };
}
