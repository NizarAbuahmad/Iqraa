/**
 * Is the app in front of the person right now? The pure half of the hooks that call the API on a
 * timer (hooks/usePollingRefresh.ts, hooks/useUsageHeartbeat.ts), so bare `node --test` can pin it.
 *
 * On the web the answer is the tab's visibility: a tab behind another one is not in front, and a
 * timer there kept fetching every 20 s for as long as the tab stayed open. On a phone it is the
 * app state.
 */
export interface FrontState {
  /** `Platform.OS`. */
  os: string;
  /** `document.visibilityState`, or undefined where there is no document. */
  visibilityState: string | undefined;
  /** `AppState.currentState`. */
  appState: string | null | undefined;
}

export function isInFront(s: FrontState): boolean {
  if (s.os === 'web') return s.visibilityState === undefined || s.visibilityState === 'visible';
  return s.appState === 'active';
}
