/**
 * Playing an English-hub word.
 *
 * The recordings are pre-voiced once by `lib/curriculum/scripts/generate-english-audio.ts`
 * into the same anonymous-read bucket as the book figures — a constant, for the
 * reason `FIGURE_BASE_URL` gives.
 *
 * `expo-audio` on native. It is a native module, which is why `app.json`'s
 * `version` moved with it (see CLAUDE.md): an OTA carrying this file to a
 * binary without the module would crash on launch. Web plays through its own
 * <audio> element so a missing recording can fall back to speech
 * (`wordSpeech.ts`) — `playWord` below says why.
 *
 * Never rejects. A word that will not play is still on screen to be read, and
 * an error banner over a flashcard helps nobody.
 *
 * On a phone a clip is played from a copy saved on the device when there is one
 * (`audioCache.ts`), and a lesson's clips are fetched ahead when it opens
 * (`prefetchLessonAudio`), so a weak connection or the `r2.dev` rate limit no
 * longer means silence on every tap. The web is untouched: the browser caches
 * the files itself, and its path below must stay exactly as it was
 * (`englishAudioPhone.test.ts`).
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';
import { audioSlug } from '@workspace/curriculum/englishHub';
import { lessonAudioTexts } from '@workspace/curriculum/englishAudioPlan';
import { playRecordingOrSpeak } from './wordSpeech';
import { claimAudio, registerAudioStop } from './audioExclusive';
import { englishAudioCache } from './audioCacheStore';

export const ENGLISH_AUDIO_BASE_URL = 'https://pub-d9ddd8f74e734a21824518b812652124.r2.dev/english-audio';

export function englishAudioUrl(word: string): string {
  return `${ENGLISH_AUDIO_BASE_URL}/${audioSlug(word)}.mp3`;
}

/** The phone's saved clips, keyed by slug; the remote object for a slug has the same name. */
const cache = () => englishAudioCache(slug => `${ENGLISH_AUDIO_BASE_URL}/${slug}.mp3`);

/**
 * What a phone plays for `word`: the saved copy if there is one; otherwise the
 * remote file, exactly as before, while a copy is saved in the background for
 * next time. Never waits for that download and never throws.
 */
function nativeSource(word: string): { uri: string } {
  const remote = englishAudioUrl(word);
  try {
    const slug = audioSlug(word);
    const local = cache().localUri(slug);
    if (local) return { uri: local };
    void cache().save(slug);
  } catch {
    // No cache this session: the network, as before.
  }
  return { uri: remote };
}

const NOTHING_TO_CANCEL = () => {};

/**
 * Fetches a hub lesson's clips onto the phone in the background so its
 * activities play without the network. Called from the lesson screen's effect,
 * which hands the returned cancel back as its cleanup: leaving the lesson stops
 * its queue, and opening another replaces it. Every background download in the
 * cache shares two slots (`audioCache.ts`). `grammar: false` while the lesson's
 * grammar is not offered (no teacher has signed it), so only the words are
 * fetched. Nothing on the web — the browser has its own cache.
 */
export function prefetchLessonAudio(lessonId: string, opts: { grammar?: boolean } = {}): () => void {
  if (Platform.OS === 'web') return NOTHING_TO_CANCEL;
  try {
    const slugs = lessonAudioTexts(lessonId, opts).map(audioSlug);
    const run = cache().prefetch(slugs);
    void run.done.catch(() => {});
    return () => run.cancel();
  } catch {
    // A lesson that cannot be fetched ahead still plays from the network.
    return NOTHING_TO_CANCEL;
  }
}

let player: AudioPlayer | null = null;
let modeSet = false;
/** Stops the web word in flight (recording or spoken fallback). */
let stopWebWord: (() => void) | null = null;

function stopWeb(): void {
  stopWebWord?.();
  stopWebWord = null;
}

// Another audio (the Quran Corner's recitation) starting cuts a word off, and
// the reverse is `claimAudio('word')` below — one at a time, as the header of
// `playLocalUri` says.
registerAudioStop('word', () => {
  try {
    player?.pause();
  } catch {
    // Nothing playing.
  }
  stopWeb();
});

/**
 * One player, reused: tapping a second word cuts off the first rather than talking over it.
 *
 * On web a word with no recording is spoken with the browser's own voice
 * instead of staying silent (`wordSpeech.ts` — `expo-audio`'s web player cannot
 * report a failed load, so the web path drives its own element). Native has no
 * such fallback: a word whose file is missing is still silent there until the
 * recording script is re-run. Native does play a saved copy first
 * (`nativeSource`); a tap with no copy always tries the network, even for a
 * clip the background fetchers have been told to leave alone.
 */
export async function playWord(word: string): Promise<void> {
  try {
    claimAudio('word');
    if (Platform.OS === 'web') {
      player?.pause();
      stopWeb();
      stopWebWord = playRecordingOrSpeak(englishAudioUrl(word), word);
      return;
    }
    if (!modeSet) {
      modeSet = true;
      // iOS mutes playback on the silent switch by default; a child tapping
      // "listen" with the switch on would hear nothing and learn nothing.
      await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    }
    const source = nativeSource(word);
    if (player) player.replace(source);
    else player = createAudioPlayer(source);
    await player.seekTo(0);
    player.play();
  } catch {
    // Unplayable is the same as silent — see the header.
  }
}

/**
 * Playing back a student's own recording (the Speaking activity). Shares the
 * one player with `playWord`, on purpose: hearing the reference word and your
 * own attempt at the same time is never useful, so one interrupting the other
 * is the correct behaviour, not a bug to route around.
 */
export async function playLocalUri(uri: string): Promise<void> {
  return playUri(uri);
}

/**
 * Any recording by URI — a local file or a signed link. The teacher's
 * marking screen plays a student's read-aloud answer through this; same
 * player, same never-rejects posture.
 */
export async function playUri(uri: string): Promise<void> {
  try {
    claimAudio('word');
    stopWeb(); // a web word still playing would talk over the recording
    if (!modeSet) {
      modeSet = true;
      await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    }
    const source = { uri };
    if (player) player.replace(source);
    else player = createAudioPlayer(source);
    await player.seekTo(0);
    player.play();
  } catch {
    // Same posture as playWord: silence over an error banner.
  }
}
