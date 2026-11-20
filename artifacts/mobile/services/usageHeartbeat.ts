/**
 * When the time-spent heartbeat may beat — the pure half of hooks/useUsageHeartbeat.ts, so bare
 * `node --test` can pin it (services/__tests__/usageHeartbeat.test.ts).
 *
 * A beat counts one minute toward the admin insights page's "where time goes". It is sent only
 * for a signed-in person, with the app in front (AppState active / the browser tab visible), who
 * has touched, typed or scrolled in the last IDLE_MS. An app left open on a desk stops counting
 * after two minutes. The server also refuses to count more than one minute per 50 s
 * (`HEARTBEAT_MIN_GAP_SECONDS`), whatever this sends.
 */
import type { UsageArea } from './usageAreas.ts';

/** How often a beat is attempted while the app is in use. */
export const BEAT_MS = 60_000;

/** No touch, key or scroll for this long and the person counts as away. */
export const IDLE_MS = 120_000;

export interface BeatState {
  signedIn: boolean;
  foreground: boolean;
  /** null for a screen that must never beat (see areaForPath). */
  area: UsageArea | null;
  lastInteractionAt: number;
  now: number;
}

export function shouldBeat(s: BeatState): boolean {
  return s.signedIn && s.foreground && s.area !== null && s.now - s.lastInteractionAt <= IDLE_MS;
}
