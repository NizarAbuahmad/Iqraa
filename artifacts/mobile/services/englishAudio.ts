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
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';
import { audioSlug } from '@workspace/curriculum/englishHub';
import { playRecordingOrSpeak } from './wordSpeech';

export const ENGLISH_AUDIO_BASE_URL = 'https://pub-d9ddd8f74e734a21824518b812652124.r2.dev/english-audio';

export function englishAudioUrl(word: string): string {
  return `${ENGLISH_AUDIO_BASE_URL}/${audioSlug(word)}.mp3`;
}

let player: AudioPlayer | null = null;
let modeSet = false;
/** Stops the web word in flight (recording or spoken fallback). */
let stopWebWord: (() => void) | null = null;

function stopWeb(): void {
  stopWebWord?.();
  stopWebWord = null;
}

/**
 * One player, reused: tapping a second word cuts off the first rather than talking over it.
 *
 * On web a word with no recording is spoken with the browser's own voice
 * instead of staying silent (`wordSpeech.ts` — `expo-audio`'s web player cannot
 * report a failed load, so the web path drives its own element). Native has no
 * such fallback: a word whose file is missing is still silent there until the
 * recording script is re-run.
 */
export async function playWord(word: string): Promise<void> {
  try {
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
    const source = { uri: englishAudioUrl(word) };
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
