/**
 * Quiet hours for family pushes: 22:00–07:00 Asia/Amman (a fixed UTC+3 since
 * Jordan dropped DST in 2022). A push in that window is still sent — a teacher
 * who posts homework at 23:00 is not delayed — but silently.
 *
 * Silently means the `quiet` channel, not only `sound: null`: on Android 8+
 * the sound belongs to the channel a notification lands in, and the message's
 * own `sound` is ignored. `sound: null` is kept for iOS, which reads it.
 * `PUSH_QUIET_HOURS=off` disables the window (the DB tests set it, so no
 * assertion depends on the time of day).
 */
import { PUSH_CHANNEL } from "../../lib/pushNotifications.ts";
import type { PushCategory } from "./pushPrefs.ts";

export const QUIET_FROM_HOUR = 22;
export const QUIET_UNTIL_HOUR = 7;
const AMMAN_OFFSET_HOURS = 3;

export function ammanHour(now: Date): number {
  return (now.getUTCHours() + AMMAN_OFFSET_HOURS) % 24;
}

export function isQuietHour(now: Date): boolean {
  const h = ammanHour(now);
  return h >= QUIET_FROM_HOUR || h < QUIET_UNTIL_HOUR;
}

export function quietHoursEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.PUSH_QUIET_HOURS !== "off";
}

export interface Delivery {
  channelId: (typeof PUSH_CHANNEL)[PushCategory | "quiet"];
  sound: "default" | null;
}

/**
 * The Android channel and sound a family push goes out with. The channel comes
 * from `PUSH_CHANNEL`, so a category with no channel there cannot compile.
 */
export function familyDelivery(category: PushCategory, now: Date, quietOn: boolean): Delivery {
  return quietOn && isQuietHour(now)
    ? { channelId: PUSH_CHANNEL.quiet, sound: null }
    : { channelId: PUSH_CHANNEL[category], sound: "default" };
}
