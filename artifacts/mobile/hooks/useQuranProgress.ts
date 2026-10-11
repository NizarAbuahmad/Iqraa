/**
 * Memorisation progress for the signed-in person, on this device. Thin on
 * purpose: every decision is in `services/quranProgress.ts`.
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

  useEffect(() => {
    let live = true;
    setLoaded(false);
    AsyncStorage.getItem(quranProgressKey(userId))
      .then(raw => {
        if (!live) return;
        const read = parseProgress(raw);
        latest.current = read;
        setProgress(read);
        setLoaded(true);
      })
      .catch(() => {
        // Storage can be unavailable (private window, blocked site data). The
        // screens still work; the ratings just do not survive a reload.
        if (live) setLoaded(true);
      });
    return () => {
      live = false;
    };
  }, [userId]);

  const rate = useCallback(
    (surah: number, ayah: number, status: AyahStatus | null) => {
      const next = rateAyah(latest.current, surah, ayah, status, todayKey());
      latest.current = next;
      setProgress(next);
      AsyncStorage.setItem(quranProgressKey(userId), JSON.stringify(next)).catch(() => {});
    },
    [userId],
  );

  return { progress, loaded, rate };
}
