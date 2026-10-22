/**
 * Each lesson's best test-yourself score: this device, per account.
 *
 * Device-only like the English hub's stars (`englishHub/progressStore.ts`): a
 * server table and a teacher view of who practised come once students use it.
 * Keyed by user id so two children signed in on one family phone (the account
 * switcher) do not share a list. A new phone starts from zero.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/context/AuthContext';
import { parseBests, recordBest, type ExerciseBests, type ExerciseScore } from './mathExercises';

export function useExerciseBests() {
  const { user } = useAuth();
  const key = `mathExercises.best.v1.${user?.id ?? 'guest'}`;
  const [bests, setBests] = useState<ExerciseBests>({});

  // On focus, so the list shows the score a student just set on the lesson screen.
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(key).then(raw => setBests(parseBests(raw))).catch(() => {});
    }, [key]),
  );

  const record = useCallback(
    async (lessonId: string, score: ExerciseScore) => {
      // Re-read first: the in-memory copy can be stale if another screen saved since focus.
      const stored = parseBests(await AsyncStorage.getItem(key).catch(() => null));
      const next = recordBest(stored, lessonId, score);
      setBests(next);
      if (next !== stored) await AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});
    },
    [key],
  );

  return { bests, record };
}
