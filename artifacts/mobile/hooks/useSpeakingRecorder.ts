/**
 * Recording state for "hear yourself say it" in the English hub.
 *
 * Cross-platform, unlike `useReadAloudRecorder`: `expo-audio`'s recorder runs
 * on iOS, Android and web alike (web is backed by `MediaRecorder` internally,
 * inside the package itself), so this needs no per-platform branch and no
 * "native has no microphone" fallback message.
 *
 * Deliberately does nothing with the recording beyond handing back a local
 * `uri` to play back. No upload, no score — see `games.ts`'s header on
 * `buildSpeakingRound`: running server transcription per word, across
 * hundreds of words and many students, is a materially bigger and more
 * frequent AI-budget cost than the curated ~6-passage read-aloud feature it
 * would otherwise resemble. Add scoring later, deliberately, once usage says
 * it's worth spending on — not by default.
 */
import { useCallback, useState } from 'react';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

export type SpeakingPhase = 'idle' | 'recording' | 'recorded' | 'denied';

export interface SpeakingRecorder {
  phase: SpeakingPhase;
  /** The last recording's local file uri, playable directly. Cleared by `reset`. */
  uri: string | null;
  /** Seconds elapsed, live, while `phase === 'recording'` — 0 otherwise. */
  seconds: number;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  /** Clears the last recording — called when moving to the next word. */
  reset: () => void;
}

export function useSpeakingRecorder(): SpeakingRecorder {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  // Polls `recorder.currentTime` — the only way to show a running counter,
  // since the recorder itself is a native object, not React state.
  const { durationMillis } = useAudioRecorderState(recorder, 200);
  const [phase, setPhase] = useState<SpeakingPhase>('idle');
  const [uri, setUri] = useState<string | null>(null);

  const start = useCallback(async () => {
    // Requested here, not at lesson load: a permission prompt should follow a
    // tap the child understands the reason for, never ambush them on arrival.
    const granted = await requestRecordingPermissionsAsync()
      .then(r => r.granted)
      .catch(() => false);
    if (!granted) {
      setPhase('denied');
      return;
    }
    setUri(null);
    await recorder.prepareToRecordAsync();
    recorder.record();
    setPhase('recording');
  }, [recorder]);

  const stop = useCallback(async () => {
    await recorder.stop();
    // A recording that produced no file is the same as none — stay `idle`
    // rather than claim a `recorded` state with nothing to play.
    setPhase(recorder.uri ? 'recorded' : 'idle');
    setUri(recorder.uri);
  }, [recorder]);

  const reset = useCallback(() => {
    setUri(null);
    setPhase('idle');
  }, []);

  return { phase, uri, seconds: phase === 'recording' ? durationMillis / 1000 : 0, start, stop, reset };
}
