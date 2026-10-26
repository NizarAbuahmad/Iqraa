/**
 * The period now or next on the teacher's timetable and its pacing-plan lesson,
 * for chrome that lives outside the screens (the tab layout: sidebar card, lesson
 * bar, ⌘K). Without it that chrome could not tell the period's lesson from an
 * old pick, and named a different lesson from the chat and Today beside it.
 *
 * `loadNextPeriod` is three requests (schedule, plans, classes), so a change of
 * `refreshKey` — the route — re-reads at most once a minute; a change of teacher
 * always re-reads and drops the previous teacher's period at once.
 */
import { useEffect, useRef, useState } from 'react';
import { loadNextPeriod } from '@/services/schedule';
import type { NextPeriodLesson } from '@/services/scheduleCalendar';

const REFRESH_AFTER_MS = 60_000;

export function useNextPeriod(enabled: boolean, userId: string | undefined, refreshKey: string): NextPeriodLesson | null {
  const [next, setNext] = useState<NextPeriodLesson | null>(null);
  const loaded = useRef<{ userId: string | undefined; at: number } | null>(null);
  // Only the newest request may land. Counted per request, not per effect run:
  // a throttled re-run starts no request, and must not orphan the one in flight.
  const latest = useRef(0);

  useEffect(() => {
    if (!enabled) {
      latest.current += 1;
      loaded.current = null;
      setNext(null);
      return;
    }
    const last = loaded.current;
    const sameTeacher = !!last && last.userId === userId;
    if (sameTeacher && Date.now() - last.at < REFRESH_AFTER_MS) return;
    if (!sameTeacher) setNext(null);
    const mine = ++latest.current;
    loaded.current = { userId, at: Date.now() };
    void loadNextPeriod().then(period => {
      if (latest.current === mine) setNext(period);
    });
  }, [enabled, userId, refreshKey]);

  return next;
}
