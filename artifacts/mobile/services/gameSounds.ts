/**
 * Class Challenge sound cues: a chime when a team is awarded, a low tone when
 * the thinking time runs out, a short fanfare on the podium. Bundled (synthesized
 * tones, no licence to track) so a classroom without a good connection still
 * hears them. One player per cue, created on first use. Best-effort, like
 * `englishAudio.ts`: a cue that cannot play is silent, never an error.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

export type GameCue = 'correct' | 'timeup' | 'podium';

const SOURCES: Record<GameCue, number> = {
  correct: require('../assets/sounds/correct.wav'),
  timeup: require('../assets/sounds/timeup.wav'),
  podium: require('../assets/sounds/podium.wav'),
};

const players: Partial<Record<GameCue, AudioPlayer>> = {};
let modeSet = false;

export function playGameCue(cue: GameCue): void {
  void (async () => {
    try {
      if (!modeSet) {
        modeSet = true;
        // iOS mutes playback on the silent switch by default.
        await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
      }
      const player = (players[cue] ??= createAudioPlayer(SOURCES[cue]));
      await player.seekTo(0);
      player.play();
    } catch {
      // Silent is the fallback.
    }
  })();
}
