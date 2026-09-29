/**
 * Where the hub's stars and streak live: this device, nowhere else. A new
 * phone or a cleared app starts from zero — accepted, not fixed.
 *
 * `recordForTeacher` below mirrors a scored result server-side too, but only
 * as a best-effort teacher-visibility signal (see englishPractice.ts) — it is
 * never read back into this device's own progress.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../apiClient';
import {
  EMPTY_PROGRESS,
  dayOf,
  parseProgress,
  recordResult,
  type HubActivity,
  type HubProgress,
} from './games';

const KEY = 'englishHub.progress.v1';

// Only these activities are scored (flashcards/speaking never reach `record`
// with a star count worth teacher visibility) — matches `SCORED_ACTIVITIES`.
const SERVER_VISIBLE: HubActivity[] = ['listen', 'match', 'spell', 'scramble', 'picture'];

/**
 * Best-effort mirror for a teacher's class view. Anonymous play (the common
 * case) gets a 401 from the server and that's fine — the on-device record
 * above already succeeded, which is the only thing that actually matters here.
 */
function recordForTeacher(lessonId: string, activity: HubActivity, stars: number) {
  if (!SERVER_VISIBLE.includes(activity)) return;
  apiFetch('/practice/english', {
    method: 'POST',
    body: JSON.stringify({ lessonId, activity, stars }),
  }).catch(() => {});
}

export function useHubProgress() {
  const [progress, setProgress] = useState<HubProgress>(EMPTY_PROGRESS);

  // On focus, not mount: the hub list must show the stars a child just earned
  // on the lesson screen they came back from.
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(KEY).then(raw => setProgress(parseProgress(raw))).catch(() => {});
    }, []),
  );

  const record = useCallback((lessonId: string, activity: HubActivity, stars: number) => {
    setProgress(prev => {
      const next = recordResult(prev, lessonId, activity, stars, dayOf(new Date()));
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      recordForTeacher(lessonId, activity, stars);
      return next;
    });
  }, []);

  return { progress, record };
}
