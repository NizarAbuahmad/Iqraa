/**
 * The time-spent heartbeat: about once a minute, while a signed-in person is actually using the
 * app, tell the API which AREA of the app they are in (POST /usage/heartbeat). The admin insights
 * page adds these up into "where does time go".
 *
 * Mounted once, in the root layout. What may beat is decided by the pure `shouldBeat`
 * (services/usageHeartbeat.ts): signed in, app in front, touched in the last two minutes. Only
 * the area name is sent (services/usageAreas.ts) — never the path, an id or a query; the platform
 * rides on the X-Iqraa-Platform header `apiFetch` already sends.
 *
 * "Touched" is `noteInteraction()`: the root view's `onTouchStart` on native (a touch anywhere
 * bubbles to it), and pointer, key, wheel and scroll listeners on the web document. A failed beat
 * is dropped — never queued or retried; a lost minute is cheaper than a burst of stale ones.
 */
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { apiFetch } from '@/services/apiClient';
import { areaForPath } from '@/services/usageAreas';
import { BEAT_MS, shouldBeat } from '@/services/usageHeartbeat';
import { isInFront } from '@/services/foreground';

let lastInteractionAt = Date.now();

/** Marks "the person is here". Cheap enough to call on every touch. */
export function noteInteraction(): void {
  lastInteractionAt = Date.now();
}

function isForeground(): boolean {
  return isInFront({
    os: Platform.OS,
    visibilityState: typeof document === 'undefined' ? undefined : document.visibilityState,
    appState: AppState.currentState,
  });
}

export function useUsageHeartbeat(signedIn: boolean, pathname: string | null | undefined): void {
  const areaRef = useRef(areaForPath(pathname ?? '/'));
  areaRef.current = pathname ? areaForPath(pathname) : null;
  const signedInRef = useRef(signedIn);
  signedInRef.current = signedIn;

  // A screen change is itself an interaction (a deep link, a push notification tap).
  useEffect(() => {
    noteInteraction();
  }, [pathname]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const events = ['pointerdown', 'keydown', 'wheel', 'scroll'] as const;
    for (const e of events) document.addEventListener(e, noteInteraction, { passive: true, capture: true });
    return () => {
      for (const e of events) document.removeEventListener(e, noteInteraction, { capture: true });
    };
  }, []);

  useEffect(() => {
    // Coming back to the app counts as being here.
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') noteInteraction();
    });
    const timer = setInterval(() => {
      const area = areaRef.current;
      const ok = shouldBeat({
        signedIn: signedInRef.current,
        foreground: isForeground(),
        area,
        lastInteractionAt,
        now: Date.now(),
      });
      if (!ok || !area) return;
      // With the usual refresh-on-401: the access token lives 15 minutes, and a screen that makes no
      // other call (a corner, a game, the whiteboard) would otherwise stop counting after that.
      apiFetch('/usage/heartbeat', { method: 'POST', body: JSON.stringify({ area }) }).catch(() => {
        // Dropped on purpose — see the header.
      });
    }, BEAT_MS);
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
}
