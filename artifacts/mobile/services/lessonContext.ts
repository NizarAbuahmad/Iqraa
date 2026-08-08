/**
 * Global "current lesson" context — the single source of truth for which
 * lesson the teacher is working on.
 *
 * Set from the home banner's picker or the chat's change-lesson sheet;
 * read by the home banner, the AI-tools hub (to prefill generators), and
 * the chat's initial teaching context. Rule of the design: tools PREFILL
 * from this context but never lock to it — a change made inside a single
 * generator stays local to that material.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const HOME_LESSON_KEY = '@iqra_home_lesson_v1';

/** Set once the teacher has seen the first-run lesson prompt. */
export const ONBOARDED_KEY = '@iqra_onboarded_v1';

export type HomeLessonPick = {
  topic: string;
  unitOrder: number | null;
  subjectId?: string;
};

export async function loadLessonPick(): Promise<HomeLessonPick | null> {
  try {
    const raw = await AsyncStorage.getItem(HOME_LESSON_KEY);
    return raw ? (JSON.parse(raw) as HomeLessonPick) : null;
  } catch {
    return null;
  }
}

export async function saveLessonPick(pick: HomeLessonPick): Promise<void> {
  try {
    await AsyncStorage.setItem(HOME_LESSON_KEY, JSON.stringify(pick));
  } catch {
    // Non-fatal: the pick still applies for the current session.
  }
}

export async function wasOnboarded(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDED_KEY)) === '1';
  } catch {
    return true; // fail closed: never nag if storage is broken
  }
}

export async function markOnboarded(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDED_KEY, '1');
  } catch {
    // ignore
  }
}
