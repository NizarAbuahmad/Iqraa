/**
 * The Quran audio player as a hook, with the release gate and a stop-on-leave.
 *
 * Call it ONCE per screen and pass what you need down to children: the
 * cleanup below stops the audio when the component that called it unmounts, so
 * calling it in a row component would cut the recitation off whenever a row
 * re-mounts. `visible` is false in a production build until
 * `QURAN_AUDIO_UPLOADED` is flipped — render no listen control when it is.
 */
import { useEffect, useSyncExternalStore } from 'react';
import {
  getQuranAudioState,
  playAyah,
  playSequence,
  stopQuranAudio,
  subscribeQuranAudio,
} from '@/services/quranAudio';
import { QURAN_AUDIO_UPLOADED, quranAudioVisible } from '@/services/quranAudioRelease';

export function useQuranAudio() {
  const s = useSyncExternalStore(subscribeQuranAudio, getQuranAudioState, getQuranAudioState);
  useEffect(() => () => stopQuranAudio(), []);
  return {
    visible: quranAudioVisible(QURAN_AUDIO_UPLOADED, __DEV__),
    playing: s.playing,
    error: s.error,
    playAyah,
    playSequence,
    stop: stopQuranAudio,
  };
}
