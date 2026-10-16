/**
 * Who of a child's accounts hears a family push, and the messages they get —
 * pure, so the rules are tested without a database. lib/familyPush.ts loads
 * the accounts and devices and sends.
 */
import type { ExpoPushMessage } from "../../lib/pushNotifications.ts";
import type { PushText } from "./familyPushText.ts";
import { allowsPush, type PushCategory } from "./pushPrefs.ts";
import type { Delivery } from "./quietHours.ts";

/** One account linked to one live roster row (lib/familyAccess.ts#accountsLinkedTo). */
export interface LinkedAccount {
  userId: string;
  relation: "self" | "guardian";
  studentId: string;
  /** The roster row's name — what a guardian's push calls the child. */
  childName: string;
  /** `users.push_prefs` as stored. */
  pushPrefs: unknown;
  suspended: boolean;
}

export type Recipient = Pick<LinkedAccount, "userId" | "relation" | "studentId" | "childName">;

/**
 * The accounts that hear a push in `category`: not suspended, and not switched
 * off for this category. One entry per (account, relation, child): a guardian
 * of two children in the class gets one push per child.
 */
export function selectRecipients(accounts: readonly LinkedAccount[], category: PushCategory): Recipient[] {
  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const a of accounts) {
    if (a.suspended || !allowsPush(a.pushPrefs, category)) continue;
    const key = `${a.userId}|${a.relation}|${a.studentId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ userId: a.userId, relation: a.relation, studentId: a.studentId, childName: a.childName });
  }
  return out;
}

/**
 * One message per recipient per device. `text` returning null leaves that
 * recipient out (the reminder uses it). The same words never go to the same
 * device twice — an account linked to two rows of one child would otherwise
 * be told twice.
 */
export function familyMessages(input: {
  recipients: readonly Recipient[];
  tokens: readonly { userId: string; expoPushToken: string }[];
  text: (r: Recipient) => PushText | null;
  data: Record<string, unknown>;
  delivery: Delivery;
}): ExpoPushMessage[] {
  const devices = new Map<string, string[]>();
  for (const t of input.tokens) devices.set(t.userId, [...(devices.get(t.userId) ?? []), t.expoPushToken]);
  const sent = new Set<string>();
  const out: ExpoPushMessage[] = [];
  for (const r of input.recipients) {
    const text = input.text(r);
    if (!text) continue;
    for (const to of devices.get(r.userId) ?? []) {
      const key = `${to}|${text.title}|${text.body}`;
      if (sent.has(key)) continue;
      sent.add(key);
      out.push({
        to,
        title: text.title,
        body: text.body,
        data: input.data,
        channelId: input.delivery.channelId,
        sound: input.delivery.sound,
      });
    }
  }
  return out;
}
