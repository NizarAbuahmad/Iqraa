import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { createPoller, type Poller } from '@/services/livePoller';
import { LIVE_POLL_MS, clockOffsetMs, isFatalPollError, rateLimitDelayMs, type ServerTime } from '@/services/liveGame';

/**
 * Polls a live-game endpoint every ~1.5 s (`LIVE_POLL_MS`).
 *
 * The loop itself is `services/livePoller.ts` (tested): it never overlaps a
 * slow request, and stops on a 401/403/404. This hook adds what needs React
 * Native: it pauses while the app or page is hidden (`AppState` is
 * react-native-web's `visibilitychange` on the web build) and polls at once
 * when it returns.
 *
 * `serverOffset` is `serverNow − Date.now()` captured when the last response
 * landed: add it to the device clock to get server time.
 *
 * Pass `null` as `fetcher` to stay idle. `resetKey` restarts the loop (a new
 * game id, a new token).
 */
export function useLivePoll<T extends { serverNow?: ServerTime }>(
  fetcher: (() => Promise<T>) | null,
  resetKey: string,
) {
  const [data, setDataState] = useState<T | null>(null);
  const [serverOffset, setServerOffset] = useState(0);
  const [offline, setOffline] = useState(false);
  const [fatal, setFatal] = useState<unknown>(null);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;
  const pollerRef = useRef<Poller | null>(null);
  const enabled = fetcher !== null;

  /** Take a response — from a poll, or from an action that returns the new state. */
  const apply = useCallback((next: T) => {
    setDataState(next);
    setServerOffset(clockOffsetMs(next.serverNow));
    setOffline(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    setFatal(null);
    setDataState(null);
    const poller = createPoller<T>({
      intervalMs: LIVE_POLL_MS,
      fetch: () => fetchRef.current!(),
      onData: apply,
      isFatal: isFatalPollError,
      retryDelay: rateLimitDelayMs,
      onError: (e, isFatal) => {
        if (isFatal) setFatal(e);
        // A rate limit is the server asking us to slow down, not a lost connection.
        else if ((e as { status?: number } | null)?.status !== 429) setOffline(true);
      },
    });
    pollerRef.current = poller;
    poller.setPaused(AppState.currentState !== 'active');
    poller.start();
    const sub = AppState.addEventListener('change', s => poller.setPaused(s !== 'active'));
    return () => {
      sub.remove();
      poller.stop();
      pollerRef.current = null;
    };
  }, [enabled, resetKey, apply]);

  const refresh = useCallback(() => pollerRef.current?.pollNow(), []);

  /**
   * Take the state an action answered with. A poll already in flight is
   * dropped (restart bumps the loop's generation), or its older reply would
   * put the screen back a step for a second and a half.
   */
  const mutate = useCallback((next: T) => {
    pollerRef.current?.stop();
    apply(next);
    pollerRef.current?.start();
  }, [apply]);

  return { data, serverOffset, offline, fatal, mutate, refresh };
}

/** A clock that ticks while `active`, for the countdown. Device time; the offset is the caller's. */
export function useNow(active: boolean, everyMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [active, everyMs]);
  return now;
}
