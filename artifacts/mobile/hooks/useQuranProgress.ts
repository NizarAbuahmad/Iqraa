/**
 * Memorisation progress for the signed-in person, on this device. Thin on
 * purpose: the decisions are in `services/quranProgress.ts` and the state, the
 * read/write ordering and the user-switch guards are in
 * `services/quranProgressStore.ts`.
 *
 * ONE store serves every call of this hook. The Quran Corner screens stay
 * mounted under each other on the root Stack, so they must share their marks:
 * a rating made in the memorise screen is on the reader and the home row
 * the moment it is made, and writes from any screen compose onto the same copy.
 *
 * A snapshot is shown only when it belongs to the person this render is for, so
 * for the one render after a user switch (before the effect re-points the
 * store) the previous person's marks are not painted. While the session is
 * still restoring (`isLoading`) the person is unknown, so nothing is read and
 * a tap cannot be saved under the signed-out key.
 */
import { useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/context/AuthContext';
import { quranProgressKey, type AyahStatus, type QuranProgress } from '@/services/quranProgress';
import { createProgressStore } from '@/services/quranProgressStore';

const store = createProgressStore(AsyncStorage);

const EMPTY: QuranProgress = Object.freeze({}) as QuranProgress;

export function useQuranProgress(): {
  progress: QuranProgress;
  loaded: boolean;
  rate: (surah: number, ayah: number, status: AyahStatus | null) => void;
} {
  const { user, isLoading } = useAuth();
  const userId = user?.id ?? null;
  // The key this render should show; null while the session is restoring.
  const wanted = isLoading ? null : quranProgressKey(userId);

  useEffect(() => {
    store.select(isLoading ? undefined : userId);
  }, [isLoading, userId]);

  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  // Never show, or accept ratings against, another person's snapshot.
  const current = wanted !== null && snap.forKey === wanted;

  return { progress: current ? snap.progress : EMPTY, loaded: current && snap.loaded, rate: store.rate };
}
