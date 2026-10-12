/**
 * The one way a family push goes out (homework, exam dates, results): which
 * of the linked accounts want it (selectRecipients), on which devices, on
 * which channel and with what sound (quiet hours), and forgetting the devices
 * Expo says are gone. The caller decides WHICH children the news is about and
 * passes their accounts (familyAccess.ts#accountsLinkedTo) and the words.
 *
 * Throws only on a database error; teacher actions wrap it in `pushWithin`,
 * the reminder run catches per homework, the release announcement logs.
 */
import { db, devicePushTokens } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { studentAccountsEnabled } from "./features.ts";
import { deadTokensFrom, sendExpoPush } from "./pushNotifications.ts";
import { familyMessages, selectRecipients, type LinkedAccount, type Recipient } from "../modules/notifications/familyPush.ts";
import type { PushText } from "../modules/notifications/familyPushText.ts";
import type { PushCategory } from "../modules/notifications/pushPrefs.ts";
import { familyDelivery, quietHoursEnabled } from "../modules/notifications/quietHours.ts";

export interface FamilyPushOutcome {
  recipients: number;
  /** Messages handed to Expo (one per recipient per device). */
  messages: number;
  delivered: number;
  pruned: number;
}

const NOTHING: FamilyPushOutcome = { recipients: 0, messages: 0, delivered: 0, pruned: 0 };

export async function sendFamilyPush(input: {
  category: PushCategory;
  accounts: readonly LinkedAccount[];
  text: (r: Recipient) => PushText | null;
  data: Record<string, unknown>;
  now?: Date;
}): Promise<FamilyPushOutcome> {
  // Homework and exam dates live on the School tab, which answers 403 while
  // student accounts are off — never push toward a closed door. Results keep
  // the behaviour they had before Part 4.
  if (input.category !== "results" && !studentAccountsEnabled()) return NOTHING;
  const recipients = selectRecipients(input.accounts, input.category);
  if (recipients.length === 0) return NOTHING;

  const tokens = await db
    .select({ userId: devicePushTokens.userId, expoPushToken: devicePushTokens.expoPushToken })
    .from(devicePushTokens)
    .where(inArray(devicePushTokens.userId, [...new Set(recipients.map(r => r.userId))]));
  const messages = familyMessages({
    recipients,
    tokens,
    text: input.text,
    data: input.data,
    delivery: familyDelivery(input.category, input.now ?? new Date(), quietHoursEnabled()),
  });
  if (messages.length === 0) return { ...NOTHING, recipients: recipients.length };

  const results = await sendExpoPush(messages);
  // A reinstalled or replaced phone leaves a dead token every later push pays for.
  const dead = deadTokensFrom(results);
  if (dead.length > 0) await db.delete(devicePushTokens).where(inArray(devicePushTokens.expoPushToken, dead));
  return {
    recipients: recipients.length,
    messages: messages.length,
    delivered: results.filter(r => r.status === "ok").length,
    pruned: dead.length,
  };
}
