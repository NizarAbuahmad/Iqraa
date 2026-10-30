/**
 * Sound and haptics for the /play answer boards, behind one mute. A right answer
 * plays the Class Challenge's «correct» chime, a wrong one a quieter «wrong» cue
 * (services/gameSounds.ts); phones also get a light tap or a soft warning. The
 * mute covers both. Best-effort throughout: a cue or a buzz that cannot play is
 * silent, never an error. On the web the first tap is what lets audio play, and
 * answering is a tap.
 */
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { playGameCue } from './gameSounds';
import { loadSoundOn, saveSoundOn } from './publicGames/feedbackPrefs';
import { playStore } from './playStore';

let soundOn = true;
let touched = false; // the user chose before the saved value came back
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

void loadSoundOn(playStore).then(saved => {
  if (touched) return;
  soundOn = saved;
  emit();
});

export function setSoundOn(on: boolean): void {
  touched = true;
  soundOn = on;
  emit();
  void saveSoundOn(playStore, on);
}

export function useSoundOn(): boolean {
  return useSyncExternalStore(
    cb => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => soundOn,
    () => true,
  );
}

export function answerFeedback(correct: boolean): void {
  if (!soundOn) return;
  playGameCue(correct ? 'correct' : 'wrong');
  if (Platform.OS !== 'web') {
    const buzz = correct
      ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    void buzz.catch(() => {});
  }
}
