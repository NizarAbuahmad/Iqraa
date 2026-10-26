/**
 * The period now or next on the teacher's timetable and its pacing-plan lesson,
 * for chrome that lives outside the screens (the tab layout: sidebar card, lesson
 * bar, ⌘K). Without it that chrome could not tell the period's lesson from an
 * old pick, and named a different lesson from the chat and Today beside it.
 *
 * It follows the shared copy in `services/lessonContext` (`getNextPeriod`), which
 * every read of the timetable — Today's reload on focus included — publishes to,
 * so the sidebar is corrected by Today's read instead of waiting for its own.
 * Its own reads fill the gaps: on a change of route and, on the web, when the
 * window regains focus. `loadNextPeriod` is three requests, so a read is skipped
 * when anyone read the timetable in the last minute, and a failed one is not
 * retried before a minute has passed either.
 *
 * `undefined` until the first answer (a different thing from `null`: read, and
 * nothing is scheduled), so a caller can tell «not heard yet» from «no lesson».
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { getNextPeriod, getNextPeriodAgeMs, subscribeNextPeriod } from '@/services/lessonContext';
import { loadNextPeriod } from '@/services/schedule';
import type { NextPeriodLesson } from '@/services/scheduleCalendar';

const REFRESH_AFTER_MS = 60_000;

export function useNextPeriod(
  enabled: boolean,
  userId: string | undefined,
  refreshKey: string,
): NextPeriodLesson | null | undefined {
  const [next, setNext] = useState(getNextPeriod);

  // A different teacher: take whatever the shared copy holds for them now (it is
  // `undefined` straight after a switch), then follow it.
  useEffect(() => {
    setNext(getNextPeriod());
    return subscribeNextPeriod(setNext);
  }, [userId]);

  const lastTried = useRef<{ userId: string | undefined; at: number } | null>(null);
  const refresh = useCallback(() => {
    if (!enabled) return;
    if (getNextPeriodAgeMs() < REFRESH_AFTER_MS) return;
    const tried = lastTried.current;
    if (tried && tried.userId === userId && Date.now() - tried.at < REFRESH_AFTER_MS) return;
    lastTried.current = { userId, at: Date.now() };
    void loadNextPeriod(); // publishes to the shared copy, which `next` follows
  }, [enabled, userId]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  // A browser tab switched back to is not a navigation: the period may have moved on.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refresh]);

  return enabled ? next : undefined;
}
