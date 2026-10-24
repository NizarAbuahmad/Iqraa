import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { getMyRosterClaims, withdrawPendingClaim } from '@/services/roster';
import { claimScreenState, interpretClaimRead, type PendingClaim } from '@/services/claimWaiting';

/**
 * The waiting-for-the-teacher state of a class-code claim, shared by the two
 * screens that can hold one: `app/claim-required.tsx` and `app/join-class.tsx`
 * (a student is no longer gated onto the first, so the second is where most
 * of them see it). A class-code pick by a student is held by the server
 * (api-server `lib/claimDecision.ts`); this hook reads what is held, looks
 * again on request, and withdraws the request so another name can be picked.
 *
 * What a read means is decided by `interpretClaimRead` (services/claimWaiting.ts):
 * links before pending, so an approval is never shown as a decline. A FAILED
 * read changes nothing, for the same reason.
 *
 * Every async result is dropped when something newer started after it (a
 * request counter) or the screen is gone, so a slow read cannot overwrite what
 * the person has since done.
 *
 * `adoptLinksOnMount`: claim-required is mandatory, so an account that already
 * has a link on arrival is let in. join-class is optional and is also how a
 * linked account adds a second class, so there a link on arrival means "show
 * the form as usual".
 *
 * `loaded` is true once the first read has settled (failed or not). The screens
 * keep their submit button off until then, so the form cannot be used in the
 * moment before a waiting card replaces it.
 */
export type ClaimRefresh = 'linked' | 'waiting' | 'none' | 'failed' | 'stale';

export function useClaimWaiting(opts: { onLinked: () => void; adoptLinksOnMount: boolean }) {
  const { t } = useLanguage();
  const [pending, setPending] = useState<PendingClaim[]>([]);
  const [wasWaiting, setWasWaiting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const screen = claimScreenState(pending, wasWaiting);

  // The caller's callback changes every render; the mount effect must not re-run for it.
  const onLinkedRef = useRef(opts.onLinked);
  onLinkedRef.current = opts.onLinked;
  const wasWaitingRef = useRef(false);
  const seq = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const apply = useCallback((nextPending: PendingClaim[], nextWasWaiting: boolean) => {
    wasWaitingRef.current = nextWasWaiting;
    setPending(nextPending);
    setWasWaiting(nextWasWaiting);
  }, []);

  /** True when `mine` is still the latest thing that started and the screen is up. */
  const live = (mine: number) => mounted.current && seq.current === mine;

  const refresh = useCallback(async (mount: boolean): Promise<ClaimRefresh> => {
    const mine = ++seq.current;
    try {
      const { links, pending: waiting } = await getMyRosterClaims();
      if (!live(mine)) return 'stale';
      const outcome = interpretClaimRead(links, waiting, {
        wasWaiting: wasWaitingRef.current,
        adoptLinks: !mount || opts.adoptLinksOnMount,
      });
      if (outcome.kind === 'linked') {
        onLinkedRef.current();
        return 'linked';
      }
      if (outcome.kind === 'ignore') return 'none';
      apply(outcome.pending, outcome.wasWaiting);
      return outcome.pending.length > 0 ? 'waiting' : 'none';
    } catch {
      return live(mine) ? 'failed' : 'stale';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.adoptLinksOnMount, apply]);

  // An account that asked earlier (another session, or after signing in again) opens straight on the waiting card.
  useEffect(() => {
    void refresh(true).then(() => { if (mounted.current) setLoaded(true); });
  }, [refresh]);

  /** A claim the screen just submitted came back held. */
  const hold = useCallback((claim: PendingClaim) => {
    seq.current++;
    apply([claim], true);
    setError('');
    setChecking(false);
  }, [apply]);

  const check = useCallback(async () => {
    setChecking(true);
    setError('');
    const state = await refresh(false);
    if (state === 'stale') return;
    if (state === 'waiting') setError(t('claimWaitingStill'));
    else if (state === 'failed') setError(t('joinAnotherClassFailed'));
    setChecking(false);
  }, [refresh, t]);

  /**
   * "Pick a different name": withdraws the waiting request only (never a link:
   * the teacher may have approved since the card last looked). If the answer
   * says a link exists, it was approved meanwhile and the account is let in;
   * otherwise the form comes back. A failure keeps the card.
   */
  const change = useCallback(async () => {
    const mine = ++seq.current;
    setChecking(true);
    setError('');
    try {
      const { hasRosterLink } = await withdrawPendingClaim();
      if (!live(mine)) return;
      if (hasRosterLink) {
        onLinkedRef.current();
        return;
      }
      apply([], false);
    } catch {
      if (!live(mine)) return;
      setError(t('joinAnotherClassFailed'));
    }
    setChecking(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apply, t]);

  return { screen, checking, error, loaded, hold, check, change };
}
