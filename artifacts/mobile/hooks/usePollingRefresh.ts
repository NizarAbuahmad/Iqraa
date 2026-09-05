/**
 * Re-runs a screen's load while that screen is on top, and again the moment
 * the app itself comes back to the foreground.
 *
 * Messaging has no realtime transport by design (the plan chose push plus
 * refresh-on-open over running a WebSocket server), and the screens only ever
 * fetched inside `useFocusEffect`. That fires on *navigation* focus, so a
 * thread left open never refetched at all: a message that arrived while you
 * were reading it did not appear until you navigated away and back, or
 * reloaded the page. On web that is worse than it sounds, because switching
 * browser tabs is not navigation either.
 *
 * `AppState` covers the second half on both platforms — React Native Web
 * implements it on top of the document's visibility, so returning to the tab
 * counts as becoming `active` the same way returning to the app does.
 *
 * Deliberately not a subscription or a socket. This is a handful of GETs a
 * minute per open screen at a scale of one teacher's own contacts; the moment
 * that stops being true, the answer is push (already built, needs a native
 * build) rather than a faster interval.
 */
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

export const DEFAULT_POLL_MS = 20000;

export function usePollingRefresh(load: () => void | Promise<void>, intervalMs = DEFAULT_POLL_MS) {
  // Held in a ref so a caller passing a fresh closure each render does not
  // restart the interval on every render — the timer depends on the delay,
  // never on the identity of the function.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      const run = () => {
        void loadRef.current();
      };

      const timer = setInterval(run, intervalMs);
      const subscription = AppState.addEventListener('change', state => {
        // Only on the way back in. Refetching as the app leaves would be work
        // nobody is looking at.
        if (state === 'active') run();
      });

      return () => {
        clearInterval(timer);
        // react-native-web's AppState.addEventListener returns undefined when
        // there is no DOM to read visibility from (`AppState.isAvailable`),
        // so this cannot assume it got a subscription back.
        subscription?.remove();
      };
    }, [intervalMs]),
  );
}
