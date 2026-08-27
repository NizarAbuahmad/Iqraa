/**
 * Global "current lesson" context — the single source of truth for which
 * lesson the teacher is working on.
 *
 * Set from the home banner's picker or the chat's change-lesson sheet;
 * read by the home banner, the AI-tools hub (to prefill generators), and
 * the chat's initial teaching context. Rule of the design: tools PREFILL
 * from this context but never lock to it — a change made inside a single
 * generator stays local to that material.
 *
 * Storage is scoped PER USER: AuthContext calls setActiveLessonContextUser
 * on login/register/restore/logout. Without the scoping, a second account
 * on the same device inherited the previous teacher's lesson and never saw
 * the first-run onboarding picker.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const HOME_LESSON_KEY = '@iqra_home_lesson_v1';
const ONBOARDED_KEY = '@iqra_onboarded_v1';

/** Set once the teacher dismisses the home "start here" coach card. */
const COACH_DISMISSED_KEY = '@iqra_coach_dismissed_v1';

/** Current user id — null while signed out. */
let activeUserId: string | null = null;

/** Called by AuthContext whenever the signed-in user changes. */
export function setActiveLessonContextUser(userId: string | null): void {
  activeUserId = userId;
}

function scopedKey(base: string): string {
  return activeUserId ? `${base}:${activeUserId}` : base;
}

export type HomeLessonPick = {
  topic: string;
  unitOrder: number | null;
  subjectId?: string;
  /** Absent on picks saved before Grade 9 existed — readers fall back to grade-10. */
  gradeId?: string;
  /**
   * KB id of the lesson that was picked. Optional because picks saved before
   * this field existed have none, and because entire-unit / entire-book picks
   * are not a single lesson — both fall back to searching for `topic`, which
   * is what every reader used to do and is why a restored pick could come
   * back as a neighbouring lesson.
   */
  lessonId?: string | null;
};

export async function loadLessonPick(): Promise<HomeLessonPick | null> {
  try {
    const raw = await AsyncStorage.getItem(scopedKey(HOME_LESSON_KEY));
    return raw ? (JSON.parse(raw) as HomeLessonPick) : null;
  } catch {
    return null;
  }
}

export async function saveLessonPick(pick: HomeLessonPick): Promise<void> {
  try {
    await AsyncStorage.setItem(scopedKey(HOME_LESSON_KEY), JSON.stringify(pick));
  } catch {
    // Non-fatal: the pick still applies for the current session.
  }
}

export async function wasOnboarded(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(scopedKey(ONBOARDED_KEY))) === '1';
  } catch {
    return true; // fail closed: never nag if storage is broken
  }
}

export async function markOnboarded(): Promise<void> {
  try {
    await AsyncStorage.setItem(scopedKey(ONBOARDED_KEY), '1');
  } catch {
    // ignore
  }
}

export async function wasCoachDismissed(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(scopedKey(COACH_DISMISSED_KEY))) === '1';
  } catch {
    return true; // fail closed: never nag
  }
}

export async function setCoachDismissed(dismissed: boolean): Promise<void> {
  try {
    if (dismissed) {
      await AsyncStorage.setItem(scopedKey(COACH_DISMISSED_KEY), '1');
    } else {
      await AsyncStorage.removeItem(scopedKey(COACH_DISMISSED_KEY));
    }
  } catch {
    // ignore
  }
}
