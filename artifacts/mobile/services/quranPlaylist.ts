/**
 * What the Quran audio player plays, in what order, how many times — as a
 * small reducer with no I/O, so it is tested. `quranAudio.ts` owns the sound;
 * this owns the decisions. `IDLE_PLAYLIST` is both "never started" and "stopped":
 * a "finished" event arriving after Stop advances an idle playlist to idle
 * again, so a late event cannot restart playback.
 *
 * No `react-native` / `expo-*` import, so `node --test` can load it.
 */
export interface PlaylistAyah {
  surah: number;
  ayah: number;
}

export interface PlaylistState {
  queue: readonly PlaylistAyah[];
  index: number;
  active: boolean;
}

export const IDLE_PLAYLIST: PlaylistState = { queue: [], index: 0, active: false };

/** A learner repeating an ayah a few times; ten is already more than anyone sits through. */
export const MAX_REPEAT = 10;

export function clampRepeat(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 1;
  return Math.min(MAX_REPEAT, Math.max(1, Math.floor(n)));
}

/** Each ayah repeated in place: [a, b] × 2 → a a b b. */
export function buildQueue(items: readonly PlaylistAyah[], repeat = 1): PlaylistAyah[] {
  const r = clampRepeat(repeat);
  return items.flatMap(item => Array.from({ length: r }, () => item));
}

export function startPlaylist(queue: readonly PlaylistAyah[]): PlaylistState {
  return queue.length === 0 ? IDLE_PLAYLIST : { queue, index: 0, active: true };
}

export function advancePlaylist(s: PlaylistState): PlaylistState {
  if (!s.active) return IDLE_PLAYLIST;
  const index = s.index + 1;
  return index >= s.queue.length ? IDLE_PLAYLIST : { queue: s.queue, index, active: true };
}

export function currentOf(s: PlaylistState): PlaylistAyah | null {
  return s.active ? (s.queue[s.index] ?? null) : null;
}
