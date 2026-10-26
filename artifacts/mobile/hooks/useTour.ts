/**
 * The React side of the first-run tour: whether to start it on its own, and how
 * Profile starts it again. The rules are `tourBlocker` in services/tour.ts; this
 * only feeds it the app's live state.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useViewportWidth } from '@/hooks/useViewportWidth';
import { DESKTOP_BREAKPOINT } from '@/constants/layout';
import { homeHrefFor, isTourHome, tourBlocker, tourRoleOf, type TourLayout } from '@/services/tour';
import {
  beginTour,
  clearReplayRequest,
  isReplayPending,
  requestReplay,
  subscribeTour,
} from '@/services/tourStore';
import { hasTarget } from '@/services/tourRegistry';
import { hasDoneTour, isTourSuppressed, markTourDone } from '@/services/tourStorage';

/** The route has to hold still this long (past `Entrance`'s motion and any redirect) before the tour starts. */
const STABLE_MS = 700;
/** A replay that never reaches the home screen (a stalled navigation) is dropped after this, not kept for later. */
const REPLAY_GIVE_UP_MS = 8000;

export function useTourLayout(): TourLayout {
  const viewportW = useViewportWidth();
  return Platform.OS === 'web' && viewportW >= DESKTOP_BREAKPOINT ? 'desktop' : 'phone';
}

/**
 * Starts the tour once for a new account that has landed on its home screen, and
 * starts a requested replay once the home screen has arrived.
 *
 * The automatic one is marked done at the moment it starts, not when it ends: a
 * process killed halfway never shows it again, and Skip and Done need no branch
 * of their own. Profile → «Replay the tour» is the way back.
 */
export function useTourAutostart(): void {
  const { user, isLoading, gradeSetupSkipped } = useAuth();
  const pathname = usePathname();
  const layout = useTourLayout();
  const userId = user?.id;
  const [done, setDone] = useState<boolean | null>(null);
  const [suppressed, setSuppressed] = useState<boolean | null>(null);
  const replayPending = useSyncExternalStore(subscribeTour, isReplayPending, isReplayPending);

  useEffect(() => {
    setDone(null);
    if (!userId) return;
    let alive = true;
    void hasDoneTour(userId).then(v => { if (alive) setDone(v); });
    return () => { alive = false; };
  }, [userId]);

  useEffect(() => {
    let alive = true;
    void isTourSuppressed().then(v => { if (alive) setSuppressed(v); });
    return () => { alive = false; };
  }, []);

  const blocker = tourBlocker({ user, pathname, layout, isLoading, gradeSetupSkipped, done, suppressed, now: Date.now() });
  const role = tourRoleOf(user?.role);

  useEffect(() => {
    if (blocker !== null || !userId || !role) return;
    const timer = setTimeout(() => {
      setDone(true);
      void markTourDone(userId);
      beginTour({ role, layout, source: 'auto', isAvailable: hasTarget });
    }, STABLE_MS);
    return () => clearTimeout(timer);
  }, [blocker, userId, role, layout]);

  // A replay the person asked for from Profile: wait for the home screen to
  // arrive and hold still, the same as the automatic start does. It does not
  // look at the done flag — asking for it is the point.
  useEffect(() => {
    if (!replayPending || !role || !isTourHome(role, pathname)) return;
    const timer = setTimeout(() => beginTour({ role, layout, source: 'replay', isAvailable: hasTarget }), STABLE_MS);
    return () => clearTimeout(timer);
  }, [replayPending, role, pathname, layout]);
}

/** Profile's «Replay the tour». `canReplay` is false for an account that has no tour (an admin). */
export function useReplayTour(): { canReplay: boolean; replay: () => void } {
  const { user } = useAuth();
  const role = tourRoleOf(user?.role);
  const replay = useCallback(() => {
    if (!role) return;
    requestReplay();
    router.navigate(homeHrefFor(role) as never);
    setTimeout(clearReplayRequest, REPLAY_GIVE_UP_MS);
  }, [role]);
  return { canReplay: role !== null, replay };
}
