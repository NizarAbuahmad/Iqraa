/**
 * The Quran audio player as a hook, with the release gate and a stop-on-leave.
 *
 * Audio stops when the screen loses focus (a pushed screen, another tab) and
 * when it unmounts. In an expo-router stack the screen stays mounted under a
 * pushed one, so unmount alone would leave the recitation playing with no stop
 * control in sight.
 *
 * Call it ONCE per screen and pass what you need down to children: the
 * cleanups below stop the audio when the component that called it blurs or
 * unmounts, so calling it in a row component would cut the recitation off
 * whenever a row re-mounts. `visible` is false in a production build until
 * `QURAN_AUDIO_UPLOADED` is flipped — render no listen control when it is.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
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
  useFocusEffect(useCallback(() => () => stopQuranAudio(), []));
  return {
    visible: quranAudioVisible(QURAN_AUDIO_UPLOADED, __DEV__),
    playing: s.playing,
    error: s.error,
    playAyah,
    playSequence,
    stop: stopQuranAudio,
  };
}
