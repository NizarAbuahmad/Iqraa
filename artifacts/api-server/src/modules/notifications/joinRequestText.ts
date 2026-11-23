/**
 * What the teacher's «طلب انضمام» push says, and where tapping it lands. Pure —
 * lib/joinRequestNotify.ts looks the names up and sends.
 *
 * Arabic only, like every push here (familyPushText.ts): it goes out from the
 * joiner's request, with no teacher locale in hand. The body names the request
 * («طلب باسم …»), never the joiner, so no verb has to agree with a child whose
 * gender the roster does not record. The account's own name is not in the push:
 * a code-only signup is named after the roster name it picked (codeSignup in
 * routes/roster.ts), so the push would print the same name twice and look like
 * proof. The banner it opens shows both, with that warning.
 */
import { PUSH_CHANNEL } from "../../lib/pushNotifications.ts";
import { TITLE_MAX, clip, type PushText } from "./familyPushText.ts";
import { isQuietHour } from "./quietHours.ts";

/** `data.screen` for a join-request push — the app maps it to the class (notificationDeepLink.ts). */
export const JOIN_REQUEST_SCREEN = "class-link-requests";

export function joinRequestText(i: { studentName: string; className: string }): PushText {
  const name = clip(i.studentName, 40);
  const klass = clip(i.className, 40);
  const where = klass ? ` في ${klass}` : "";
  return {
    title: clip("طلب انضمام جديد", TITLE_MAX),
    body: name ? `طلب باسم «${name}»${where} — بانتظار موافقتك.` : `طلب انضمام${where} — بانتظار موافقتك.`,
  };
}

/**
 * One push per class per this window. A teacher who writes the code on the board
 * gets thirty picks in five minutes, and thirty rings in a lesson is noise: the
 * first one says a request is waiting, and the class banner and the bell (which
 * count) show the rest. A pick after the window is news again.
 */
export const JOIN_REQUEST_PUSH_WINDOW_MINUTES = 10;

/** Whether this request pushes, given how many OTHER requests in the class were made within the window. */
export function joinRequestPushes(othersInWindow: number): boolean {
  return othersInWindow === 0;
}

/**
 * Silent between 22:00 and 07:00 Amman, as family pushes are (quietHours.ts): a
 * student redeeming a code at midnight must not ring the teacher's phone. The
 * `quiet` channel, not only `sound: null`, because Android takes the sound from
 * the channel.
 */
export function joinRequestDelivery(now: Date, quietOn: boolean): {
  channelId: typeof PUSH_CHANNEL.requests | typeof PUSH_CHANNEL.quiet;
  sound: "default" | null;
} {
  return quietOn && isQuietHour(now)
    ? { channelId: PUSH_CHANNEL.quiet, sound: null }
    : { channelId: PUSH_CHANNEL.requests, sound: "default" };
}

export function joinRequestData(classGroupId: string): { screen: string; classGroupId: string } {
  return { screen: JOIN_REQUEST_SCREEN, classGroupId };
}
