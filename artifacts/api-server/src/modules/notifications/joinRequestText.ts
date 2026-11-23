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
import { TITLE_MAX, clip, type PushText } from "./familyPushText.ts";

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

export function joinRequestData(classGroupId: string): { screen: string; classGroupId: string } {
  return { screen: JOIN_REQUEST_SCREEN, classGroupId };
}
