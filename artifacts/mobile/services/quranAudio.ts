/**
 * Playing the Quran Corner's recitation (Sheikh Mahmoud Khalil Al-Husary,
 * murattal), one MP3 per ayah from the public bucket.
 *
 * What plays, in what order and how often is `quranPlaylist.ts` (a tested
 * reducer); this file is the sound and a tiny store the screens subscribe to.
 *
 * - Native: one `expo-audio` player, reused. `expo-audio` is already installed,
 *   so this adds no native module and `app.json`'s `version` does not move.
 * - Web: its own <audio> element, because `expo-audio`'s web player cannot
 *   report a failed load (the same reason `wordSpeech.ts` does this).
 * - Never throws. A recording that will not play becomes `error: true` for the
 *   screen to say so quietly, never an exception or a banner over the text.
 * - Needs the network: there is no download or cache in this slice.
 * - Starting claims the shared "one audio at a time" slot (`audioExclusive.ts`),
 *   so it cuts off a flashcard word and is cut off by one.
 *
 * NOT VERIFIED on a device or in a browser: nothing here has played a real
 * recording (the files are not uploaded yet and the build sandbox cannot reach
 * them). In particular the native "did it just finish" status event is the
 * piece to watch on the first real device run.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { Platform } from 'react-native';
import { quranAyahAudioUrl } from '@workspace/curriculum/quran-audio';
import { claimAudio, registerAudioStop } from './audioExclusive';
import {
  IDLE_PLAYLIST,
  advancePlaylist,
  buildQueue,
  currentOf,
  startPlaylist,
  type PlaylistAyah,
  type PlaylistState,
} from './quranPlaylist';

export interface QuranAudioState {
  playing: PlaylistAyah | null;
  error: boolean;
}

/**
 * How long a recording may take to START PLAYING before we say it cannot play.
 * Nothing else catches a recording that loads but never plays: on Android
 * (observed in expo-audio 1.1.1's AudioPlayer.kt) a failed load reports loaded,
 * and a stalled connection never errors. Cleared at the first `playing: true`
 * (see `startNative`).
 */
const LOAD_TIMEOUT_MS = 10_000;

// ─── the store ───────────────────────────────────────────────────────────────

let snapshot: QuranAudioState = { playing: null, error: false };
const listeners = new Set<() => void>();

/** Stable reference unless something changed, as `useSyncExternalStore` requires. */
function publish(next: QuranAudioState): void {
  if (next.playing === snapshot.playing && next.error === snapshot.error) return;
  snapshot = next;
  listeners.forEach(l => l());
}

export function getQuranAudioState(): QuranAudioState {
  return snapshot;
}

export function subscribeQuranAudio(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ─── the two sound backends ──────────────────────────────────────────────────

interface Playback {
  stop(): void;
}
type StartPlayback = (url: string, onEnded: () => void, onError: () => void) => Playback;

interface WebAudio {
  onended: null | (() => void);
  onerror: null | (() => void);
  play(): Promise<void> | void;
  pause(): void;
}

const startWeb: StartPlayback = (url, onEnded, onError) => {
  const Ctor = (globalThis as unknown as { Audio?: new (src: string) => WebAudio }).Audio;
  if (!Ctor) {
    setTimeout(onError, 0);
    return { stop() {} };
  }
  let dead = false;
  const el = new Ctor(url);
  el.onended = () => {
    if (!dead) onEnded();
  };
  el.onerror = () => {
    if (!dead) onError();
  };
  try {
    const p = el.play();
    if (p && typeof (p as Promise<void>).catch === 'function') {
      (p as Promise<void>).catch(() => {
        if (!dead) onError();
      });
    }
  } catch {
    setTimeout(() => {
      if (!dead) onError();
    }, 0);
  }
  return {
    stop() {
      dead = true;
      try {
        el.pause();
      } catch {
        // Already gone.
      }
    },
  };
};

let player: AudioPlayer | null = null;
let modeSet = false;
/** The status handler of the playback in flight; one at a time, replaced on every start. */
let onStatus: ((s: AudioStatus) => void) | null = null;

const startNative: StartPlayback = (url, onEnded, onError) => {
  let dead = false;
  let started = false;
  // The only guard against a recording that loads but never plays (a 404 on
  // Android reports `isLoaded: true` and no error ever follows). Cleared at the
  // first `playing: true`, never on `isLoaded`. A stale `playing: true` queued
  // from the PREVIOUS recording could still clear it early: rarer, and only
  // verifiable on a device.
  const timer = setTimeout(() => {
    if (!dead && !started) onError();
  }, LOAD_TIMEOUT_MS);

  void (async () => {
    try {
      if (!modeSet) {
        modeSet = true;
        // iOS mutes playback on the silent switch by default; a student who
        // taps "listen" with it on would hear nothing and learn nothing.
        await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
      }
      if (dead) return;
      onStatus = status => {
        if (dead) return;
        if (status.playing && !started) {
          started = true;
          clearTimeout(timer);
        }
        // Only a finish AFTER this playback began counts: the previous
        // recording's own "finished" must not skip this one.
        if (status.didJustFinish && started) onEnded();
      };
      const source = { uri: url };
      if (player) {
        player.replace(source);
      } else {
        player = createAudioPlayer(source);
        player.addListener('playbackStatusUpdate', status => onStatus?.(status));
      }
      await player.seekTo(0);
      if (dead) return;
      player.play();
    } catch {
      if (!dead) onError();
    }
  })();

  return {
    stop() {
      dead = true;
      clearTimeout(timer);
      onStatus = null;
      try {
        player?.pause();
      } catch {
        // Already gone.
      }
    },
  };
};

// ─── the driver ──────────────────────────────────────────────────────────────

let state: PlaylistState = IDLE_PLAYLIST;
let playback: Playback | null = null;
/** Bumped on every start and stop; a callback from a superseded playback checks it and does nothing. */
let generation = 0;

function halt(error: boolean): void {
  generation++;
  playback?.stop();
  playback = null;
  state = IDLE_PLAYLIST;
  publish({ playing: null, error });
}

function playCurrent(): void {
  const current = currentOf(state);
  if (!current) {
    halt(false);
    return;
  }
  // First, so an out-of-range ref halts cleanly instead of throwing out of
  // `playSequence` with the store already showing 'playing'.
  let url: string;
  try {
    url = quranAyahAudioUrl(current.surah, current.ayah);
  } catch {
    halt(true);
    return;
  }
  playback?.stop();
  const gen = ++generation;
  publish({ playing: current, error: false });
  const start = Platform.OS === 'web' ? startWeb : startNative;
  playback = start(
    url,
    () => {
      if (gen !== generation) return;
      state = advancePlaylist(state);
      playCurrent();
    },
    () => {
      if (gen !== generation) return;
      halt(true);
    },
  );
}

/** Plays `items` in order, each `repeat` times in place. Replaces whatever was playing. */
export function playSequence(items: readonly PlaylistAyah[], opts: { repeat?: number } = {}): void {
  claimAudio('quran');
  state = startPlaylist(buildQueue(items, opts.repeat ?? 1));
  playCurrent();
}

export function playAyah(surah: number, ayah: number): void {
  playSequence([{ surah, ayah }]);
}

/** Stops, and clears a shown "couldn't play". Safe to call when nothing is playing. */
export function stopQuranAudio(): void {
  if (state.active || snapshot.error) halt(false);
}

registerAudioStop('quran', () => {
  if (state.active) halt(false);
});
