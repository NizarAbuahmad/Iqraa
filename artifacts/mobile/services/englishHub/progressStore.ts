/**
 * Where the hub's stars and streak live: this device, nowhere else.
 *
 * v1 on purpose — a server table and a teacher view come once students are
 * actually using this (Phase 2 of the English hub plan). Until then a new phone
 * or a cleared app starts from zero, which costs a child some stars and nothing
 * else.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  EMPTY_PROGRESS,
  dayOf,
  parseProgress,
  recordResult,
  type HubActivity,
  type HubProgress,
} from './games';

const KEY = 'englishHub.progress.v1';

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
      return next;
    });
  }, []);

  return { progress, record };
}
