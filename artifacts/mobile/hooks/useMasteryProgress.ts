import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { NO_PROGRESS, type MasteryProgress } from '@/services/lessonLock';
import { getMyProgress } from '@/services/studentExam';

/**
 * The signed-in student's mastery progress, refreshed whenever the screen
 * regains focus — a student who passes a quiz and comes back must see the next
 * lesson open without reopening the app. Anyone who is not a student gets
 * `NO_PROGRESS`, so teachers and parents are never gated and never make the call.
 */
export function useMasteryProgress(): MasteryProgress {
  const { user } = useAuth();
  const isStudent = user?.role === 'student';
  const [progress, setProgress] = useState<MasteryProgress>(NO_PROGRESS);

  useFocusEffect(
    useCallback(() => {
      if (!isStudent) {
        setProgress(NO_PROGRESS);
        return;
      }
      let live = true;
      getMyProgress().then(p => {
        if (live) setProgress(p);
      });
      return () => {
        live = false;
      };
    }, [isStudent]),
  );

  return progress;
}
