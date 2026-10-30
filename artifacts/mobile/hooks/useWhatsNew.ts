/**
 * The React side of «ما الجديد»: whether to open the dialog on its own. The rules
 * are `whatsNewBlocker` in services/whatsNew.ts; this only feeds it the app's live
 * state, the same way `useTourAutostart` feeds the tour.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { trackEvent } from '@/services/analytics';
import { tourRoleOf } from '@/services/tour';
import { isReplayPending, isTourActive, subscribeTour } from '@/services/tourStore';
import { hasDoneTour, isTourSuppressed } from '@/services/tourStorage';
import { unseenFor, whatsNewBlocker, type SeenIds, type WhatsNewEntry } from '@/services/whatsNew';
import { getSeenWhatsNew, markWhatsNewSeen } from '@/services/whatsNewStorage';

/** Longer than the tour's 700 ms, so a tour that is going to start has started first. */
const STABLE_MS = 1500;

const tourBusyNow = () => isTourActive() || isReplayPending();

/**
 * Calls `onShow` once with this account's unseen entries when it has settled on
 * its home screen. The entries are marked seen at that moment, not when the
 * dialog is closed: a process killed with it open never shows them again, and
 * Profile → «ما الجديد» is the way back.
 */
export function useWhatsNewAutostart(onShow: (entries: WhatsNewEntry[]) => void): void {
  const { user, isLoading, gradeSetupSkipped } = useAuth();
  const pathname = usePathname();
  const userId = user?.id;
  const [seen, setSeen] = useState<SeenIds | null>(null);
  const [tourDone, setTourDone] = useState<boolean | null>(null);
  const [suppressed, setSuppressed] = useState<boolean | null>(null);
  const tourBusy = useSyncExternalStore(subscribeTour, tourBusyNow, tourBusyNow);

  useEffect(() => {
    setSeen(null);
    setTourDone(null);
    if (!userId) return;
    let alive = true;
    void getSeenWhatsNew(userId).then(v => { if (alive) setSeen(v); });
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
    const timer = setTimeout(() => {
      if (tourBusyNow()) return;
      const entries = unseenFor({ role, createdAt: Date.parse(createdAt), seen, now: Date.now() });
      if (entries.length === 0) return;
      const ids = entries.map(e => e.id);
      setSeen(seen === 'all' ? 'all' : [...seen, ...ids]);
      void markWhatsNewSeen(userId, ids);
      trackEvent('whats_new_shown', { role, count: entries.length, ids: ids.join(',') });
      onShow(entries);
    }, STABLE_MS);
    return () => clearTimeout(timer);
  }, [blocker, userId, role, createdAt, seen, onShow]);
}
