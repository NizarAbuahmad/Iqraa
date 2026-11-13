/**
 * The React side of «ما الجديد»: whether to open the dialog on its own, and which
 * tool cards wear «جديد». The rules are `whatsNewBlocker` and `newToolIds` in
 * services/whatsNew.ts; this only feeds them the app's live state, the same way
 * `useTourAutostart` feeds the tour.
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { trackEvent } from '@/services/analytics';
import { tourRoleOf } from '@/services/tour';
import { isReplayPending, isTourActive, subscribeTour } from '@/services/tourStore';
import { hasDoneTour, isTourSuppressed } from '@/services/tourStorage';
import { ALL_TOOLS } from '@/services/toolCatalog';
import { newToolIds, toolIdsForPath, unseenFor, whatsNewBlocker, type SeenIds, type WhatsNewEntry } from '@/services/whatsNew';
import {
  getSessionSeen,
  getSessionToolsOpened,
  subscribeSeen,
  subscribeToolsOpened,
  withSessionSeen,
} from '@/services/whatsNewSession';
import { getOpenedNewTools, getSeenWhatsNew, markNewToolsOpened, markWhatsNewSeen } from '@/services/whatsNewStorage';

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

const NO_TOOLS: ReadonlySet<string> = new Set();

/**
 * The tools whose cards wear «جديد» for the signed-in account (empty until storage
 * has answered, and for anyone without a role or a creation date). Read by the
 * Tools tab and the chat "+" menu; the session store makes a card lose its badge
 * the moment the tool is opened.
 */
export function useNewTools(): ReadonlySet<string> {
  const { user } = useAuth();
  const userId = user?.id;
  const role = tourRoleOf(user?.role);
  const createdAt = user?.createdAt;
  const [stored, setStored] = useState<SeenIds | null>(null);
  const session = useSyncExternalStore(subscribeToolsOpened, getSessionToolsOpened, getSessionToolsOpened);

  useEffect(() => {
    setStored(null);
    if (!userId) return;
    let alive = true;
    void getOpenedNewTools(userId).then(v => { if (alive) setStored(v); });
    return () => { alive = false; };
  }, [userId]);

  return useMemo(() => {
    const opened = withSessionSeen(stored, session, userId);
    if (!role || !createdAt || opened === null) return NO_TOOLS;
    return newToolIds({ role, createdAt: Date.parse(createdAt), opened, now: Date.now() });
  }, [stored, session, userId, role, createdAt]);
}

/**
 * Clears a new tool's «جديد» when its screen is opened, by whatever way in — its
 * card, a link from Today or the chat, a deep link. Mounted once, at the root
 * (WhatsNewHost). Only a tool that is new right now is recorded, so a tool
 * opened long ago still gets its badge if it is announced again.
 */
export function useClearNewToolOnVisit(): void {
  const { user } = useAuth();
  const userId = user?.id;
  const pathname = usePathname();
  const newTools = useNewTools();

  useEffect(() => {
    if (!userId || newTools.size === 0) return;
    const visited = toolIdsForPath(pathname, ALL_TOOLS).filter(id => newTools.has(id));
    if (visited.length === 0) return;
    trackEvent('new_tool_opened', { ids: visited.join(',') });
    void markNewToolsOpened(userId, visited);
  }, [pathname, userId, newTools]);
}
