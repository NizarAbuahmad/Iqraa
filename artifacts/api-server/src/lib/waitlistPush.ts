/**
 * The push an admin gets when someone joins iqrra.com's waitlist. Kept apart
 * from adminNotify.ts, which imports the database at module scope, so the
 * wording can be unit-tested.
 */
import { PUSH_CHANNEL } from "./pushNotifications.ts";

const MAX_BODY = 120;

export function waitlistPush(signup: { email: string; context: string }) {
  // `context` is whatever the site's form sent (up to 500 chars), so it is
  // clipped rather than trusted to fit a notification.
  const body = (signup.context ? `${signup.email} · ${signup.context}` : signup.email).slice(0, MAX_BODY);
  return {
    title: "تسجيل جديد في قائمة الانتظار",
    body,
    data: { screen: "admin-signups" },
    channelId: PUSH_CHANNEL.admin,
  };
}
