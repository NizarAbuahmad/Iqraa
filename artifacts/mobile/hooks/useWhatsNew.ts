/**
 * The React side of «ما الجديد»: whether to open the dialog on its own. The rules
 * are `whatsNewBlocker` in services/whatsNew.ts; this only feeds it the app's live
 * state, the same way `useTourAutostart` feeds the tour.
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { trackEvent } from '@/services/analytics';
import { tourRoleOf } from '@/services/tour';
import { isReplayPending, isTourActive, subscribeTour } from '@/services/tourStore';
import { hasDoneTour, isTourSuppressed } from '@/services/tourStorage';
import { unseenFor, whatsNewBlocker, type SeenIds, type WhatsNewEntry } from '@/services/whatsNew';
import { getSessionSeen, subscribeSeen, withSessionSeen } from '@/services/whatsNewSession';
import { getSeenWhatsNew, markWhatsNewSeen } from '@/services/whatsNewStorage';

/** Longer than the tour's 700 ms, so a tour that is going to start has started first. */
const STABLE_MS = 1500;

const tourBusyNow = () => isTourActive() || isReplayPending();

/**
 * Calls `onShow` with this account's unseen entries when it has settled on its
 * home screen — at most once per account per session, so entries past the
 * dialog's few wait for the next launch (or Profile) instead of replacing the
 * card a moment later. They are marked seen at that moment, not when the dialog
 * is closed: a process killed with it open never shows them again.
 */
export function useWhatsNewAutostart(onShow: (entries: WhatsNewEntry[]) => void): void {
  const { user, isLoading, gradeSetupSkipped } = useAuth();
  const pathname = usePathname();
  const userId = user?.id;
  const [stored, setStored] = useState<SeenIds | null>(null);
  const [tourDone, setTourDone] = useState<boolean | null>(null);
  const [suppressed, setSuppressed] = useState<boolean | null>(null);
  const tourBusy = useSyncExternalStore(subscribeTour, tourBusyNow, tourBusyNow);
  // What the Profile screen (or this dialog) marked seen since storage was read.
  const session = useSyncExternalStore(subscribeSeen, getSessionSeen, getSessionSeen);
  const seen = useMemo(() => withSessionSeen(stored, session, userId), [stored, session, userId]);
  const shownFor = useRef<string | null>(null);

  useEffect(() => {
    setStored(null);
    setTourDone(null);
    if (!userId) return;
    let alive = true;
    void getSeenWhatsNew(userId).then(v => { if (alive) setStored(v); });
    void hasDoneTour(userId).then(v => { if (alive) setTourDone(v); });
    return () => { alive = false; };
  }, [userId]);

  useEffect(() => {
    let alive = true;
    void isTourSuppressed().then(v => { if (alive) setSuppressed(v); });
    return () => { alive = false; };
  }, []);

  const blocker = whatsNewBlocker({
    user, pathname, isLoading, gradeSetupSkipped, seen, suppressed, tourDone, tourBusy, now: Date.now(),
  });
  const role = tourRoleOf(user?.role);
  const createdAt = user?.createdAt;

  useEffect(() => {
    if (blocker !== null || !userId || !role || !createdAt || seen === null) return;
    if (shownFor.current === userId) return;
    const timer = setTimeout(() => {
      if (tourBusyNow() || shownFor.current === userId) return;
      const entries = unseenFor({ role, createdAt: Date.parse(createdAt), seen, now: Date.now() });
      if (entries.length === 0) return;
      shownFor.current = userId;
      const ids = entries.map(e => e.id);
      void markWhatsNewSeen(userId, ids);
      trackEvent('whats_new_shown', { role, count: entries.length, ids: ids.join(',') });
      onShow(entries);
    }, STABLE_MS);
    return () => clearTimeout(timer);
  }, [blocker, userId, role, createdAt, seen, onShow]);
}
