/**
 * Playing an English-hub word.
 *
 * The recordings are pre-voiced once by `lib/curriculum/scripts/generate-english-audio.ts`
 * into the same anonymous-read bucket as the book figures — a constant, for the
 * reason `FIGURE_BASE_URL` gives.
 *
 * `expo-audio` on every platform, web included. It is a native module, which is
 * why `app.json`'s `version` moved with it (see CLAUDE.md): an OTA carrying
 * this file to a binary without the module would crash on launch.
 *
 * Never rejects. A word that will not play is still on screen to be read, and
 * an error banner over a flashcard helps nobody.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { audioSlug } from '@workspace/curriculum/englishHub';

export const ENGLISH_AUDIO_BASE_URL = 'https://pub-d9ddd8f74e734a21824518b812652124.r2.dev/english-audio';

export function englishAudioUrl(word: string): string {
  return `${ENGLISH_AUDIO_BASE_URL}/${audioSlug(word)}.mp3`;
}

let player: AudioPlayer | null = null;
let modeSet = false;

/** One player, reused: tapping a second word cuts off the first rather than talking over it. */
export async function playWord(word: string): Promise<void> {
  try {
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
