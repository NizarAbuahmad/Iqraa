/**
 * The recording state machine, shared by the exam question and the practice card.
 *
 * Both screens need the same four things — a phase, a visible elapsed time, an
 * error a student can act on, and a hard stop at the ceiling. Keeping one copy
 * is what stops the 120-second limit drifting between them, which is the kind
 * of difference nobody notices until a recording is rejected on one screen and
 * accepted on the other.
 *
 * What it deliberately does NOT do is decide what happens to the audio. The
 * exam uploads it against a question and keeps it; practice sends it for a
 * score and throws it away. That difference is the caller's, and passing it in
 * as `onRecorded` is what lets one machine serve both.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { MAX_RECORD_MS, isRecordingSupported, startRecording, type ActiveRecording } from '@/services/readAloudRecorder';

export type RecordingPhase = 'idle' | 'recording' | 'working';

export interface ReadAloudRecorder {
  phase: RecordingPhase;
  elapsedMs: number;
  error: string;
  /** False where there is no microphone to reach — native today. */
  supported: boolean;
  /** Start, or stop-and-hand-over if already recording. */
  toggle: () => void;
  setError: (message: string) => void;
}

export function useReadAloudRecorder(options: {
  /** Called with the finished audio and how long it ran. May throw to surface a message. */
  onRecorded: (audio: Blob, durationMs: number) => Promise<void>;
  /** Shown when the microphone cannot be opened — almost always a denied prompt. */
  micErrorMessage: string;
  /** Shown when `onRecorded` fails without a message of its own. */
  failureMessage: string;
}): ReadAloudRecorder {
  const { onRecorded, micErrorMessage, failureMessage } = options;

  const [phase, setPhase] = useState<RecordingPhase>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState('');
  const startedAtRef = useRef(0);
  const activeRef = useRef<ActiveRecording | null>(null);

  const supported = Platform.OS === 'web' && isRecordingSupported();

  const finish = useCallback(async () => {
    const active = activeRef.current;
    if (!active) return;
    // Cleared first: the ceiling timer and a student's tap can both land here,
    // and stopping the same recorder twice rejects.
    activeRef.current = null;
    const durationMs = Math.min(Date.now() - startedAtRef.current, MAX_RECORD_MS);
    setPhase('working');
    try {
      const audio = await active.stop();
      await onRecorded(audio, durationMs);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : failureMessage);
    } finally {
      setPhase('idle');
    }
  }, [onRecorded, failureMessage]);

  // Tick the visible timer, and stop at the ceiling rather than letting a
  // student talk into an upload the server will refuse for being too long.
  useEffect(() => {
    if (phase !== 'recording') return;
    const id = setInterval(() => {
      const ms = Date.now() - startedAtRef.current;
      setElapsedMs(ms);
      if (ms >= MAX_RECORD_MS) void finish();
    }, 250);
    return () => clearInterval(id);
  }, [phase, finish]);

  const toggle = useCallback(() => {
    if (phase === 'working') return;
    if (phase === 'recording') {
      void finish();
      return;
    }
    setError('');
    void startRecording()
      .then(active => {
        activeRef.current = active;
        startedAtRef.current = Date.now();
        setElapsedMs(0);
        setPhase('recording');
      })
      .catch(() => {
        // Naming the microphone is more use than "something went wrong": the
        // fix is a permission prompt in the browser's own UI, not in the app.
        setError(micErrorMessage);
        setPhase('idle');
      });
  }, [phase, finish, micErrorMessage]);

  return { phase, elapsedMs, error, supported, toggle, setError };
}
