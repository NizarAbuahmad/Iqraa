/**
 * Each lesson's best test-yourself score: on this device per account, and for a
 * student, on the server too so the teacher sees it.
 *
 * The device copy (keyed by user id so two children on one family phone keep
 * separate lists) drives the student's own screens and works offline. A
 * student's finished set is also sent to `PUT /student/math-practice`, which keeps
 * the best per roster row and counts attempts; a send that fails is dropped, the
 * device copy stays. The teacher reads it with `fetchClassPractice`.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isStudentRole, useAuth } from '@/context/AuthContext';
import { apiFetch } from './apiClient';
import {
  normalizeClassPractice,
  parseBests,
  recordBest,
  type ClassPracticeRow,
  type ExerciseBests,
  type ExerciseScore,
} from './mathExercises';

export function useExerciseBests() {
  const { user } = useAuth();
  const key = `mathExercises.best.v1.${user?.id ?? 'guest'}`;
  const isStudent = isStudentRole(user?.role);
  const [bests, setBests] = useState<ExerciseBests>({});

  // On focus, so the list shows the score a student just set on the lesson screen.
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(key).then(raw => setBests(parseBests(raw))).catch(() => {});
    }, [key]),
  );

  const record = useCallback(
    async (lessonId: string, score: ExerciseScore) => {
      // Every finished set goes up, not just a new best: the server counts attempts.
      if (isStudent) {
        void apiFetch('/student/math-practice', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lessonId, correct: score.correct, total: score.total }),
        }).catch(() => {});
      }
      // Re-read first: the in-memory copy can be stale if another screen saved since focus.
      const stored = parseBests(await AsyncStorage.getItem(key).catch(() => null));
      const next = recordBest(stored, lessonId, score);
      setBests(next);
      if (next !== stored) await AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});
    },
    [key, isStudent],
  );

  return { bests, record };
}

/** A class's practice for its teacher; throws on a failed request so the sheet can offer a retry. */
export async function fetchClassPractice(classId: string): Promise<ClassPracticeRow[]> {
  const res = await apiFetch(`/classes/${encodeURIComponent(classId)}/math-practice`);
  if (!res.ok) throw new Error(`Loading practice failed (${res.status})`);
  const data = (await res.json()) as { results?: unknown };
  return normalizeClassPractice(data.results);
}
