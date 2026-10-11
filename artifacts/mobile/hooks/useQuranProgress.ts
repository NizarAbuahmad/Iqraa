/**
 * Memorisation progress for the signed-in person, on this device. Thin on
 * purpose: every decision is in `services/quranProgress.ts`.
 *
 * Two guards live here. On a change of user, the marks in state are cleared
 * before the new read, so one person's progress never shows or saves under
 * another's key on a shared device. And `rate` is ignored until the current
 * user's saved marks have been read, so a tap can never overwrite them with a
 * one-mark blob.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/context/AuthContext';
import {
  parseProgress,
  quranProgressKey,
  rateAyah,
  todayKey,
  type AyahStatus,
  type QuranProgress,
} from '@/services/quranProgress';

export function useQuranProgress(): {
  progress: QuranProgress;
  loaded: boolean;
  rate: (surah: number, ayah: number, status: AyahStatus | null) => void;
} {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [progress, setProgress] = useState<QuranProgress>({});
  const [loaded, setLoaded] = useState(false);
  // The latest value, so two quick taps compose instead of the second one
  // overwriting the first with a stale copy.
  const latest = useRef<QuranProgress>({});
  // The storage key whose contents are in `latest`. Null until that user's read
  // has landed. A ref, not `loaded`, because `rate` reads it without re-rendering.
  const loadedKey = useRef<string | null>(null);

  useEffect(() => {
    const key = quranProgressKey(userId);
    let live = true;
    // Another person's marks must not outlive a switch of user, and nothing may
    // be saved under the new key until it has been read (or the read failed).
    loadedKey.current = null;
    latest.current = {};
    setProgress({});
    setLoaded(false);
    AsyncStorage.getItem(key)
      .then(raw => {
        if (!live) return;
        const read = parseProgress(raw);
        latest.current = read;
        loadedKey.current = key;
        setProgress(read);
        setLoaded(true);
      })
      .catch(() => {
        // Storage can be unavailable (private window, blocked site data); the
        // screens still work with empty progress, and writes will fail the same way.
        if (!live) return;
        loadedKey.current = key;
        setLoaded(true);
      });
    return () => {
      live = false;
    };
  }, [userId]);

  const rate = useCallback(
    (surah: number, ayah: number, status: AyahStatus | null) => {
      const key = quranProgressKey(userId);
      // Ignore a rating until this user's saved marks have been read: writing now
      // would replace them with a one-mark blob. Screens disable the buttons while !loaded.
      if (loadedKey.current !== key) return;
      const next = rateAyah(latest.current, surah, ayah, status, todayKey());
      latest.current = next;
      setProgress(next);
      AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});
    },
    [userId],
  );

  return { progress, loaded, rate };
}
