/**
 * "Come back and practice" — opt-in, local-only, no server involved, matching
 * the rest of the hub's device-local design.
 *
 * A one-shot `DATE` trigger, not a repeating `DAILY` one: a repeating
 * notification fires on schedule whether or not the goal was already met that
 * day, and there is no way to cancel just today's occurrence without
 * cancelling the whole series. Rescheduling one shot at a time — call
 * `syncDailyReminder` whenever the hub screen is focused — means the next
 * reminder is always set (or skipped) against today's real progress, at the
 * cost of only correcting itself when the app is actually opened. That
 * trade-off is stated, not hidden: a student who never reopens the app before
 * the reminder hour keeps getting reminded on the schedule set last time they did.
 *
 * Web is a no-op, same as `pushTokens.ts` — expo-notifications' web path needs
 * its own service-worker setup this app doesn't have.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ENABLED_KEY = 'englishHub.reminderEnabled';
const SCHEDULED_ID_KEY = 'englishHub.reminderId';
/** Local hour the reminder fires at, if not already practised by then. */
const REMINDER_HOUR = 17;

export async function isReminderEnabled(): Promise<boolean> {
  return Platform.OS !== 'web' && (await AsyncStorage.getItem(ENABLED_KEY)) === 'true';
}

async function cancelPending(): Promise<void> {
  const id = await AsyncStorage.getItem(SCHEDULED_ID_KEY);
  if (!id) return;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  await AsyncStorage.removeItem(SCHEDULED_ID_KEY);
}

/** Today at `REMINDER_HOUR`, or tomorrow if that time has already passed. */
function nextReminderTime(now: Date): Date {
  const at = new Date(now);
  at.setHours(REMINDER_HOUR, 0, 0, 0);
  if (at.getTime() <= now.getTime()) at.setDate(at.getDate() + 1);
  return at;
}

/**
 * Turn reminders on: asks for notification permission (a real OS prompt, so
 * only call this from an explicit opt-in tap, never on screen load), then
 * schedules the next one. Returns false if permission was refused, so the UI
 * can leave its toggle off rather than claim a reminder that will never fire.
 */
export async function enableDailyReminder(title: string, body: string, practicedToday: boolean): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return false;
  await AsyncStorage.setItem(ENABLED_KEY, 'true');
  await syncDailyReminder(title, body, practicedToday);
  return true;
}

export async function disableDailyReminder(): Promise<void> {
  await AsyncStorage.setItem(ENABLED_KEY, 'false');
  await cancelPending();
}

/**
 * Call whenever the hub screen gains focus. Idempotent: cancels whatever was
 * pending and reschedules from scratch against the current `practicedToday`,
 * so re-running it on every focus is cheap and never double-books a reminder.
 */
export async function syncDailyReminder(title: string, body: string, practicedToday: boolean): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!(await isReminderEnabled())) return;
  await cancelPending();
  if (practicedToday) return; // today's goal is met — nothing to remind about until tomorrow's focus.
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: nextReminderTime(new Date()) },
    });
    await AsyncStorage.setItem(SCHEDULED_ID_KEY, id);
  } catch {
    // Best-effort, matching pushTokens.ts: a scheduling failure must never
    // block using the hub itself.
  }
}
