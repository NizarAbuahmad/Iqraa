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

/** Reminder homework (homeworkReminders.db.test.ts). Unique titles, so a test can find each in a push body. */
export const RM_TITLES = {
  c1: "rm-c1",
  c1Done: "rm-c1-done",
  c3: "rm-c3",
  c2: "rm-c2",
  today: "rm-today",
  dayAfter: "rm-day-after",
  archived: "rm-archived",
  archivedClass: "rm-archived-class",
} as const;

/** The instant a due date `offsetDays` Amman days from now is stored as: the end of that day, Amman. */
export function ammanDueAt(offsetDays: number, now: Date = new Date()): Date {
  const day = new Date(now.getTime() + 3 * 3_600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - 3 * 3_600_000);
}

/**
 * Homework around "tomorrow" (Amman), each there to be reminded about or to
 * be left alone:
 *   c1 (t1, tomorrow)        Sara (account, not done) + Adam (no account)
 *   c1Done (t1, tomorrow)    Sara has ticked it; Adam still has no account
 *   c3 (t1, tomorrow)        Noor — family B
 *   c2 (t2, tomorrow)        Sara's second row (no account) + Adam's ARCHIVED row
 *   today / dayAfter          not tomorrow
 *   archived / archivedClass  archived homework / homework in the archived class c4
 */
export async function seedReminderHomework(pool: Pool, w: FamilyWorld): Promise<Record<keyof typeof RM_TITLES, string>> {
  const { t1, t2 } = w.users;
  const { c1, c2, c3, c4 } = w.classes;
  const hw = async (teacher: string, klass: string, title: string, offset: number, archived = false) =>
    (
      await pool.query<{ id: string }>(
        `INSERT INTO homework (teacher_id, class_group_id, title, due_at, archived_at)
         VALUES ($1, $2, $3, $4, CASE WHEN $5::boolean THEN now() END) RETURNING id`,
        [teacher, klass, title, ammanDueAt(offset), archived],
      )
    ).rows[0].id;
  const ids = {
    c1: await hw(t1, c1, RM_TITLES.c1, 1),
    c1Done: await hw(t1, c1, RM_TITLES.c1Done, 1),
    c3: await hw(t1, c3, RM_TITLES.c3, 1),
    c2: await hw(t2, c2, RM_TITLES.c2, 1),
    today: await hw(t1, c1, RM_TITLES.today, 0),
    dayAfter: await hw(t1, c1, RM_TITLES.dayAfter, 2),
    archived: await hw(t1, c1, RM_TITLES.archived, 1, true),
    archivedClass: await hw(t1, c4, RM_TITLES.archivedClass, 1),
  };
  await pool.query(`INSERT INTO homework_completions (homework_id, student_id) VALUES ($1, $2)`, [ids.c1Done, w.students.sA1]);
  return ids;
}
