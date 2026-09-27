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
import { todayISO } from './planEntries.ts';

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
  /**
   * Local date (`YYYY-MM-DD`) the teacher made this pick; set by
   * `saveLessonPick`. The home card lets a pick made today override the
   * lesson the timetable + pacing plan say is next, and lets an older one
   * yield to it. Absent on picks saved before the field existed — read as old.
   */
  pickedOn?: string;
};

type LessonPickListener = (pick: HomeLessonPick | null) => void;
const lessonPickListeners = new Set<LessonPickListener>();

/**
 * Notified on every `saveLessonPick`, so chrome that displays the pick outside
 * the screen that set it (the tab bar's context strip) updates immediately
 * instead of only on its own next mount — AsyncStorage itself has no such
 * event.
 */
export function subscribeLessonPick(fn: LessonPickListener): () => void {
  lessonPickListeners.add(fn);
  return () => lessonPickListeners.delete(fn);
}

export async function loadLessonPick(): Promise<HomeLessonPick | null> {
  try {
    const raw = await AsyncStorage.getItem(scopedKey(HOME_LESSON_KEY));
    return raw ? (JSON.parse(raw) as HomeLessonPick) : null;
  } catch {
    return null;
  }
}

/**
 * Whether the timetable's lesson should replace the teacher's pick. A pick
 * made today is a decision and wins; an older one (or none) is where they
 * were, and yields. Home and chat both ask this, so they show one lesson.
 */
export function timetableWins(pick: HomeLessonPick | null, hasScheduledLesson: boolean, today: string): boolean {
  if (!hasScheduledLesson) return false;
  return !(pick?.topic?.trim() && pick.pickedOn === today);
}

export async function saveLessonPick(input: HomeLessonPick): Promise<void> {
  const pick = { ...input, pickedOn: input.pickedOn ?? todayISO() };
  try {
    await AsyncStorage.setItem(scopedKey(HOME_LESSON_KEY), JSON.stringify(pick));
  } catch {
    // Non-fatal: the pick still applies for the current session.
  } finally {
    lessonPickListeners.forEach(fn => fn(pick));
  }
}

/*
  «غير مطلوب» choices on the readiness board: lesson key (`prepLessonKey`) →
  the prep row types the teacher said this lesson does not need. On the
  device, per user, like the pick itself.
  ponytail: device-local, so it does not follow the teacher to another
  device; move it to the server if teachers switch devices mid-prep.
*/
const PREP_SKIPS_KEY = '@iqra_prep_skips_v1';

async function readPrepSkips(): Promise<Record<string, string[]>> {
  try {
    const raw = await AsyncStorage.getItem(scopedKey(PREP_SKIPS_KEY));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Row types marked not needed for this lesson. */
export async function loadPrepSkips(lessonKey: string | null): Promise<string[]> {
  if (!lessonKey) return [];
  const list = (await readPrepSkips())[lessonKey];
  return Array.isArray(list) ? list.filter(x => typeof x === 'string') : [];
}

/** Mark or unmark one row as not needed; returns the lesson's new list. */
export async function setPrepSkip(lessonKey: string, rowType: string, skipped: boolean): Promise<string[]> {
  const all = await readPrepSkips();
  const current = new Set(Array.isArray(all[lessonKey]) ? all[lessonKey] : []);
  if (skipped) current.add(rowType);
  else current.delete(rowType);
  const next = [...current];
  if (next.length) all[lessonKey] = next;
  else delete all[lessonKey];
  try {
    await AsyncStorage.setItem(scopedKey(PREP_SKIPS_KEY), JSON.stringify(all));
  } catch {
    // Non-fatal: the choice still applies on screen for this session.
  }
  return next;
}

/** Set once the teacher closes the home card's "set up your timetable" nudge. */
const SETUP_NUDGE_DISMISSED_KEY = '@iqra_setup_nudge_dismissed_v1';

export async function wasSetupNudgeDismissed(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(scopedKey(SETUP_NUDGE_DISMISSED_KEY))) === '1';
  } catch {
    return false;
  }
}

export async function dismissSetupNudge(): Promise<void> {
  try {
    await AsyncStorage.setItem(scopedKey(SETUP_NUDGE_DISMISSED_KEY), '1');
  } catch {
    // Non-fatal: it stays closed for this session.
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
