/**
 * Push fixtures on top of the family world (seedFamilies.ts): device tokens
 * for every account, so a test can tell from a token alone who was pushed,
 * and one suspended guardian of Sara's row — suspension must stop a push, not
 * only a sign-in. Kept out of seedFamilies so no older test changes.
 * Raw SQL, like the other fixtures.
 */
import type { Pool } from "pg";

import type { FamilyWorld } from "./seedFamilies.ts";
import type { StubMessage } from "./pushStub.ts";

/** parentA has two devices: a push must reach every device of an account. */
export const PUSH_TOKENS = {
  parentA: ["ExponentPushToken[parentA-phone]", "ExponentPushToken[parentA-tablet]"],
  parentB: ["ExponentPushToken[parentB-phone]"],
  studentA: ["ExponentPushToken[studentA-phone]"],
  studentB: ["ExponentPushToken[studentB-phone]"],
  studentUnlinked: ["ExponentPushToken[studentUnlinked-phone]"],
  suspendedParent: ["ExponentPushToken[suspendedParent-phone]"],
  t1: ["ExponentPushToken[t1-phone]"],
  t2: ["ExponentPushToken[t2-phone]"],
} as const;
export type TokenOwner = keyof typeof PUSH_TOKENS;

const OWNER_OF = new Map<string, TokenOwner>(
  (Object.entries(PUSH_TOKENS) as [TokenOwner, readonly string[]][]).flatMap(([owner, tokens]) =>
    tokens.map(t => [t, owner] as [string, TokenOwner]),
  ),
);

export async function seedPushWorld(pool: Pool, w: FamilyWorld): Promise<void> {
  for (const [owner, tokens] of Object.entries(PUSH_TOKENS) as [TokenOwner, readonly string[]][]) {
    for (const token of tokens) {
      await pool.query(`INSERT INTO device_push_tokens (user_id, expo_push_token, platform) VALUES ($1, $2, 'android')`, [
        w.users[owner],
        token,
      ]);
    }
  }
  await pool.query(`INSERT INTO roster_links (student_id, user_id, relation) VALUES ($1, $2, 'guardian')`, [
    w.students.sA1,
    w.users.suspendedParent,
  ]);
}

/** The messages that went to any of this account's devices. */
export function sentTo(messages: readonly StubMessage[], owner: TokenOwner): StubMessage[] {
  const mine = new Set<string>(PUSH_TOKENS[owner]);
  return messages.filter(m => mine.has(m.to));
}

/** Who got anything, sorted — an unknown token shows up as `unknown:<token>`. */
export function ownersReached(messages: readonly StubMessage[]): string[] {
  return [...new Set(messages.map(m => OWNER_OF.get(m.to) ?? `unknown:${m.to}`))].sort();
}

/** Set an account's stored switches directly (`{}` = all on). */
export async function setPushPrefs(pool: Pool, userId: string, prefs: Record<string, boolean>): Promise<void> {
  await pool.query(`UPDATE users SET push_prefs = $2::jsonb WHERE id = $1`, [userId, JSON.stringify(prefs)]);
}

/** A YYYY-MM-DD day as a push prints it: DD-MM-YYYY in a left-to-right isolate. */
export function shownDay(ymd: string): string {
  return `⁦${ymd.slice(8, 10)}-${ymd.slice(5, 7)}-${ymd.slice(0, 4)}⁩`;
}
