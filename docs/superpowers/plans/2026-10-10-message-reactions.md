# Message Reactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let anyone in a person-to-person chat thread react to a message with one of six fixed emoji, including in announcement-only groups where they cannot post.

**Architecture:** A new `chat_message_reactions` table (unique on message + user, so one reaction per person). Two idempotent routes (`PUT`/`DELETE …/reaction`) whose decisions live in a pure, DB-free module (`lib/messageReactions.ts`) so they can be unit tested; the message list route attaches per-message `reactions` summaries. The app renders chips under each bubble, opens a sheet on long-press, updates optimistically, and the existing poll merge adopts other people's reactions.

**Tech Stack:** Express + Drizzle (Postgres) + `node --test` on the API; Expo / React Native (also the web build) with pure helpers tested under bare `node --test` on the app.

**Spec:** `docs/superpowers/specs/2026-10-10-message-reactions-design.md` (read it first; this plan implements it and does not repeat its rationale).

## Global Constraints

- Branch: develop and push only on `ccr-7b9e4e5e-ujzx2x`. The draft PR is #986 (spec); implementation commits go on the same branch and the same PR.
- Every commit message ends with these two lines (a blank line before them):
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_019vPETG2XEpBi5PM2oYMWE3`.
  Do not put a model identifier anywhere else in the repo (code, comments, PR text).
- Emoji set, in this exact order: 👍 ❤️ 😂 😮 👏 🙏. `❤️` is two code points, `❤️`.
- One reaction per user per message: unique `(message_id, user_id)`; same emoji again removes it (app side) and `PUT` of the same emoji twice is a no-op (server side).
- Reactions are **not** gated by `studentPostingEnabled`. Never add that gate.
- Error codes: `not_found` (404), `invalid_input` (400, malformed `:messageId`), `invalid_reaction` (400, emoji not in the set).
- Rate limiter: `createRateLimiter({ windowMs: 60_000, max: 60, name: "message-react", key: user id })`.
- Reactions never touch `chat_threads.updated_at`, `chat_participants.last_read_at`, `chat_message_reads`, or push notifications.
- Only `isTeacherRole` callers receive `userIds` in a reaction summary.
- Migration `0003` is additive (new table + indexes only): no `destructive-migration: ok` in the PR body.
- No native module is added, so `artifacts/mobile/app.json`'s `version` is **not** bumped.
- The reaction sheet holds no text input, so it does **not** use `KeyboardSafeView`, and no `KeyboardAvoidingView` is added anywhere (CLAUDE.md).
- Tests must live inside the existing globs: API `src/**/__tests__/**/*.test.ts`; mobile `services/__tests__/**/*.test.ts` only. Anything loaded directly by `node --test` imports with an explicit `.ts` extension. Mobile pure modules import nothing from `react-native` / `expo-*`.
- The app polls a thread every **10 seconds** (`usePollingRefresh(refresh, 10000)`), not 5 as the spec's prose says. Same design, longer wait.
- Arabic is the product language; every new string gets an Arabic and an English entry.

---

## File Structure

| File | Create / Modify | Responsibility |
| --- | --- | --- |
| `artifacts/api-server/src/lib/messageReactions.ts` | Create | Pure: emoji allow-list, `summarizeReactions`, `reactionAccess` |
| `artifacts/api-server/src/lib/__tests__/messageReactions.test.ts` | Create | Tests for the above |
| `lib/db/src/schema/messaging.ts` | Modify | `chatMessageReactions` table + type |
| `lib/db/migrations/0003_*.sql` (+ `meta/`) | Generate | Additive migration |
| `artifacts/api-server/src/routes/messaging.ts` | Modify | Two routes, list integration, limiter, header rule 4 |
| `artifacts/api-server/src/routes/__tests__/mountOrder.test.ts` | Modify | Unauthenticated reaction routes are 401 |
| `artifacts/mobile/services/messageReactions.ts` | Create | Pure: emoji list mirror, `toggleReaction`, `myReaction`, `ChatReaction` |
| `artifacts/mobile/services/messageMerge.ts` | Modify | Adopt changed reactions on poll |
| `artifacts/mobile/services/__tests__/messageReactions.test.ts` | Create | Tests for the pure module |
| `artifacts/mobile/services/__tests__/mergeNewMessages.test.ts` | Modify | Reaction-merge cases |
| `artifacts/mobile/services/__tests__/reactionEmojiParity.test.ts` | Create | API list == app list, by reading both files as text |
| `artifacts/mobile/services/messaging.ts` | Modify | `ChatMessage.reactions`, `setReaction`, `clearReaction` |
| `artifacts/mobile/services/i18n.ts` | Modify | New strings (ar + en) |
| `artifacts/mobile/components/ui/MessageBubble.tsx` | Modify | Chip row under the bubble |
| `artifacts/mobile/app/messaging/[threadId].tsx` | Modify | Message sheet, optimistic toggle, poll filtering |
| `STATUS.md` | Modify | Entry for the feature |

---

### Task 1: API pure module — allow-list, summary, access decision

**Files:**
- Create: `artifacts/api-server/src/lib/messageReactions.ts`
- Test: `artifacts/api-server/src/lib/__tests__/messageReactions.test.ts`

**Interfaces:**
- Consumes: nothing (no imports — it must load under bare `node --test` with no `db`, no OpenAI client).
- Produces (used by Task 3 and read as text by Task 4's parity test):
  - `export const REACTION_EMOJI` — single-line array literal, six entries.
  - `export type ReactionEmoji`
  - `isAllowedReaction(v: unknown): v is ReactionEmoji`
  - `interface ReactionRow { messageId: string; userId: string; emoji: string }`
  - `interface ReactionSummary { emoji: string; count: number; mine: boolean; userIds?: string[] }`
  - `summarizeReactions(rows, viewerId, opts: { viewerIsTeacher: boolean; hiddenUserIds: ReadonlySet<string> }): Map<string, ReactionSummary[]>`
  - `reactionAccess(i: ReactionAccessInput): "ok" | "not_found"`

- [ ] **Step 1: Write the failing tests**

Create `artifacts/api-server/src/lib/__tests__/messageReactions.test.ts`:

```ts
/**
 * What this guards: who may react to what, and what a reaction summary shows.
 *
 * The decision under test that is easiest to break later: a student in an
 * announcement-only group (`studentPostingEnabled = false`) MAY react. The send
 * route refuses them with `group_read_only`; a tidy-minded edit that "makes
 * reactions match" would quietly re-close the one channel they have.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  REACTION_EMOJI,
  isAllowedReaction,
  reactionAccess,
  summarizeReactions,
  type ReactionRow,
} from "../messageReactions.ts";

describe("isAllowedReaction", () => {
  it("accepts each of the six emoji", () => {
    for (const e of REACTION_EMOJI) assert.equal(isAllowedReaction(e), true, e);
    assert.equal(REACTION_EMOJI.length, 6);
  });

  it("pins the heart to heart + variation selector", () => {
    assert.equal(REACTION_EMOJI[1], "❤️");
    // A bare U+2764 is a different string: rejected loudly, not normalised.
    assert.equal(isAllowedReaction("❤"), false);
  });

  it("rejects everything else", () => {
    for (const v of ["", "👎", "😀", "👍👍", "👍‍", " 👍", "a".repeat(200), 1, null, undefined, {}, ["👍"]]) {
      assert.equal(isAllowedReaction(v), false, String(v));
    }
  });
});

const row = (messageId: string, userId: string, emoji: string): ReactionRow => ({ messageId, userId, emoji });
const none = new Set<string>();

describe("summarizeReactions", () => {
  const rows = [
    row("m1", "u1", "👍"),
    row("m1", "u2", "👍"),
    row("m1", "u3", "🙏"),
    row("m2", "u1", "😂"),
  ];

  it("counts per emoji and marks the viewer's own", () => {
    const out = summarizeReactions(rows, "u1", { viewerIsTeacher: false, hiddenUserIds: none });
    assert.deepEqual(out.get("m1"), [
      { emoji: "👍", count: 2, mine: true },
      { emoji: "🙏", count: 1, mine: false },
    ]);
    assert.deepEqual(out.get("m2"), [{ emoji: "😂", count: 1, mine: true }]);
  });

  it("has no entry for a message nobody reacted to", () => {
    const out = summarizeReactions(rows, "u1", { viewerIsTeacher: false, hiddenUserIds: none });
    assert.equal(out.has("m3"), false);
  });

  it("orders chips by the fixed emoji order, whatever order the rows came in", () => {
    const shuffled = [row("m", "a", "🙏"), row("m", "b", "👏"), row("m", "c", "👍")];
    const out = summarizeReactions(shuffled, "z", { viewerIsTeacher: false, hiddenUserIds: none });
    assert.deepEqual(out.get("m")!.map(s => s.emoji), ["👍", "👏", "🙏"]);
  });

  it("gives userIds to a teacher only, sorted so a poll never reshuffles them", () => {
    const teacher = summarizeReactions(rows, "t", { viewerIsTeacher: true, hiddenUserIds: none });
    assert.deepEqual(teacher.get("m1")![0]!.userIds, ["u1", "u2"]);
    const student = summarizeReactions(rows, "u1", { viewerIsTeacher: false, hiddenUserIds: none });
    for (const list of student.values()) for (const s of list) assert.equal("userIds" in s, false);
    const unsorted = [row("m", "b", "👍"), row("m", "a", "👍")];
    assert.deepEqual(
      summarizeReactions(unsorted, "t", { viewerIsTeacher: true, hiddenUserIds: none }).get("m")![0]!.userIds,
      ["a", "b"],
    );
  });

  it("drops reactions from hidden (blocked) users from count, mine and userIds", () => {
    const out = summarizeReactions(rows, "t", { viewerIsTeacher: true, hiddenUserIds: new Set(["u2"]) });
    assert.deepEqual(out.get("m1")![0], { emoji: "👍", count: 1, mine: false, userIds: ["u1"] });
    // A hidden viewer id cannot mark `mine`; nobody blocks themselves, but the rule is "hidden rows are gone".
    const self = summarizeReactions(rows, "u1", { viewerIsTeacher: false, hiddenUserIds: new Set(["u1"]) });
    assert.equal(self.get("m1")![0]!.mine, false);
  });

  it("removes a message whose only reactions were hidden", () => {
    const out = summarizeReactions(rows, "t", { viewerIsTeacher: false, hiddenUserIds: new Set(["u1"]) });
    assert.equal(out.has("m2"), false);
  });

  it("ignores a stored emoji outside the current set rather than showing it", () => {
    const out = summarizeReactions([row("m", "a", "🦄")], "z", { viewerIsTeacher: false, hiddenUserIds: none });
    assert.equal(out.size, 0);
  });
});

describe("reactionAccess", () => {
  const base = {
    isParticipant: true,
    messageInThread: true,
    messageArchived: false,
    viewerIsTeacher: false,
    viewerBlocksSender: false,
    threadType: "class_group" as const,
    studentPostingEnabled: true,
  };

  it("lets a participant react to a live message", () => {
    assert.equal(reactionAccess(base), "ok");
  });

  it("lets a student react in an announcement-only group — the decision this feature exists for", () => {
    assert.equal(reactionAccess({ ...base, studentPostingEnabled: false }), "ok");
    assert.equal(reactionAccess({ ...base, threadType: "custom_group", studentPostingEnabled: false }), "ok");
  });

  it("hides the thread from a non-participant", () => {
    assert.equal(reactionAccess({ ...base, isParticipant: false }), "not_found");
  });

  it("does not find a message in another thread, or an archived one", () => {
    assert.equal(reactionAccess({ ...base, messageInThread: false }), "not_found");
    assert.equal(reactionAccess({ ...base, messageArchived: true }), "not_found");
  });

  it("hides a blocked sender's message from a non-teacher, never from a teacher", () => {
    assert.equal(reactionAccess({ ...base, viewerBlocksSender: true }), "not_found");
    assert.equal(reactionAccess({ ...base, viewerBlocksSender: true, viewerIsTeacher: true }), "ok");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /home/user/Iqraa/artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/messageReactions.test.ts`
Expected: FAIL — `Cannot find module '.../messageReactions.ts'`.

- [ ] **Step 3: Write the module**

Create `artifacts/api-server/src/lib/messageReactions.ts`:

```ts
/**
 * Reactions on person-to-person chat messages (routes/messaging.ts) — the pure
 * half. No imports, so `node --test` can load it without `db` or an OpenAI key.
 *
 * Three decisions live here so they can be tested without a database:
 *
 * - which emoji exist (six, fixed — a minor can type nothing into this feature);
 * - what a viewer is shown for a message's reactions (counts for everyone, who
 *   only to teachers, nothing from accounts the viewer has blocked);
 * - who may react at all. Deliberately NOT gated by `studentPostingEnabled`: a
 *   reaction is an acknowledgement, not a post, and an announcement-only group
 *   is exactly where a student has no other way to say "understood".
 *
 * `REACTION_EMOJI` is mirrored in artifacts/mobile/services/messageReactions.ts
 * — keep that declaration line identical. A parity test reads both files.
 */
export const REACTION_EMOJI = ["👍", "❤️", "😂", "😮", "👏", "🙏"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJI)[number];

/** Exact match on purpose: a bare U+2764 is not the heart in the set, and is refused rather than normalised. */
export function isAllowedReaction(v: unknown): v is ReactionEmoji {
  return typeof v === "string" && (REACTION_EMOJI as readonly string[]).includes(v);
}

export interface ReactionRow {
  messageId: string;
  userId: string;
  emoji: string;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  mine: boolean;
  /** Teacher-role viewers only. Sorted, so a poll that sees the same people never looks like a change. */
  userIds?: string[];
}

/**
 * messageId → chips, in `REACTION_EMOJI` order. A message with nothing to show
 * has no entry. Rows from `hiddenUserIds` (the viewer's blocks — empty for a
 * teacher, who never filters) are dropped before anything is counted, and so
 * are stored emoji outside the current set.
 */
export function summarizeReactions(
  rows: readonly ReactionRow[],
  viewerId: string,
  opts: { viewerIsTeacher: boolean; hiddenUserIds: ReadonlySet<string> },
): Map<string, ReactionSummary[]> {
  const byMessage = new Map<string, Map<string, string[]>>();
  for (const r of rows) {
    if (opts.hiddenUserIds.has(r.userId)) continue;
    let perEmoji = byMessage.get(r.messageId);
    if (!perEmoji) {
      perEmoji = new Map();
      byMessage.set(r.messageId, perEmoji);
    }
    const users = perEmoji.get(r.emoji);
    if (users) users.push(r.userId);
    else perEmoji.set(r.emoji, [r.userId]);
  }

  const out = new Map<string, ReactionSummary[]>();
  for (const [messageId, perEmoji] of byMessage) {
    const chips: ReactionSummary[] = [];
    for (const emoji of REACTION_EMOJI) {
      const users = perEmoji.get(emoji);
      if (!users) continue;
      const chip: ReactionSummary = { emoji, count: users.length, mine: users.includes(viewerId) };
      if (opts.viewerIsTeacher) chip.userIds = [...users].sort();
      chips.push(chip);
    }
    if (chips.length > 0) out.set(messageId, chips);
  }
  return out;
}

export interface ReactionAccessInput {
  isParticipant: boolean;
  messageInThread: boolean;
  messageArchived: boolean;
  viewerIsTeacher: boolean;
  viewerBlocksSender: boolean;
  /** Carried only so the tests can state the rule: neither of these two ever changes the answer. */
  threadType: "direct" | "class_group" | "custom_group";
  studentPostingEnabled: boolean;
}

/**
 * One answer for every reason a reaction is refused — the route never says
 * which condition failed, so a non-member learns nothing about the thread.
 */
export function reactionAccess(i: ReactionAccessInput): "ok" | "not_found" {
  if (!i.isParticipant) return "not_found";
  if (!i.messageInThread || i.messageArchived) return "not_found";
  // A non-teacher cannot see a blocked sender's messages (the list filters them),
  // so they cannot react to one. Teachers never filter.
  if (!i.viewerIsTeacher && i.viewerBlocksSender) return "not_found";
  return "ok";
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /home/user/Iqraa/artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/messageReactions.test.ts`
Expected: PASS, all tests in the three `describe` blocks.

- [ ] **Step 5: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/api-server/src/lib/messageReactions.ts artifacts/api-server/src/lib/__tests__/messageReactions.test.ts
git commit -F - <<'EOF'
Reactions: pure allow-list, summary and access rules (API)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019vPETG2XEpBi5PM2oYMWE3
EOF
```

---

### Task 2: Schema and migration

**Files:**
- Modify: `lib/db/src/schema/messaging.ts` (add table after `chatMessageReads`, add type export)
- Generate: `lib/db/migrations/0003_*.sql`, `lib/db/migrations/meta/0003_snapshot.json`, `lib/db/migrations/meta/_journal.json`

**Interfaces:**
- Consumes: `chatMessages`, `users`, `uuid`/`text`/`timestamp`/`unique`/`index` already imported in `messaging.ts`.
- Produces: `chatMessageReactions` table and `ChatMessageReaction` type, both reachable from `@workspace/db` (the file is already re-exported by `export * from "./messaging"`). Columns: `id`, `messageId`, `userId`, `emoji`, `createdAt`, `updatedAt`.

- [ ] **Step 1: Add the table**

In `lib/db/src/schema/messaging.ts`, insert directly after the `chatMessageReads` table (before `export type RosterLink`):

```ts
/**
 * One reaction per person per message — the unique key is what makes a second
 * reaction a replace, and what lets two people tapping at once both land.
 * `emoji` is text, not an enum: the allow-list lives in the API
 * (lib/messageReactions.ts) because changing a Postgres enum is a migration.
 *
 * Not a "post": reactions are allowed in announcement-only groups, so nothing
 * here consults `chatThreads.studentPostingEnabled`.
 */
export const chatMessageReactions = pgTable(
  "chat_message_reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [
    unique("chat_message_reactions_unique").on(t.messageId, t.userId),
    index("chat_message_reactions_message_idx").on(t.messageId),
  ],
);
```

And add to the type exports at the bottom of the file:

```ts
export type ChatMessageReaction = typeof chatMessageReactions.$inferSelect;
```

- [ ] **Step 2: Generate the migration**

Run: `cd /home/user/Iqraa && pnpm --filter @workspace/db run generate`
Expected: drizzle-kit reports one new migration `0003_<adjective>_<noun>.sql` and writes `meta/0003_snapshot.json`; no interactive prompt (new table, nothing renamed).

- [ ] **Step 3: Read the SQL and check it is additive**

Run: `cd /home/user/Iqraa && cat lib/db/migrations/0003_*.sql`
Expected: exactly a `CREATE TABLE "chat_message_reactions"`, two `ADD CONSTRAINT … FOREIGN KEY … ON DELETE cascade`, a `CREATE INDEX "chat_message_reactions_message_idx"`, and the unique constraint — and **no** `DROP`, `RENAME`, `SET NOT NULL`, or type change. If anything else appears, stop and find out why before continuing.

- [ ] **Step 4: Prove all migrations apply to an empty Postgres**

This mirrors the CI check "applies all migrations to an empty Postgres". Run in one shell (the data dir must be outside `/tmp/claude-0…` or the `postgres` user cannot traverse it):

```bash
PGD=$(mktemp -d /var/tmp/iqraa-pg.XXXXXX); chown postgres "$PGD"; chmod 755 "$PGD"
runuser -u postgres -- /usr/lib/postgresql/16/bin/initdb -D "$PGD/data" -A trust >/dev/null
runuser -u postgres -- /usr/lib/postgresql/16/bin/pg_ctl -D "$PGD/data" -o "-p 54329 -k $PGD" -l "$PGD/log" -w start
psql -h 127.0.0.1 -p 54329 -U postgres -c "create database iqraa_test"
for f in /home/user/Iqraa/lib/db/migrations/0*.sql; do
  psql -h 127.0.0.1 -p 54329 -U postgres -d iqraa_test -v ON_ERROR_STOP=1 -q -f "$f" || { echo "FAILED: $f"; break; }
done
psql -h 127.0.0.1 -p 54329 -U postgres -d iqraa_test -c '\d chat_message_reactions'
echo "$PGD" > /var/tmp/iqraa-pg.path
```

Expected: no `FAILED:` line; `\d chat_message_reactions` lists the six columns, the unique constraint, the index and both foreign keys. Leave this Postgres running — Task 7 reuses it (its path is in `/var/tmp/iqraa-pg.path`).

- [ ] **Step 5: Typecheck the db package and commit**

Run: `cd /home/user/Iqraa && pnpm --filter @workspace/db exec tsc --noEmit` (if the package has no such script, run `pnpm run typecheck` from the root instead)
Expected: no errors.

```bash
git add lib/db/src/schema/messaging.ts lib/db/migrations
git commit -F - <<'EOF'
Reactions: chat_message_reactions table and migration 0003

Additive only: one new table, a unique (message, user) key and an index.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019vPETG2XEpBi5PM2oYMWE3
EOF
```

---

### Task 3: API routes and list integration

**Files:**
- Modify: `artifacts/api-server/src/routes/messaging.ts` (header rule 4; imports; `toClientMessage`; new limiter, helpers and two routes; the `GET …/messages` handler)
- Modify: `artifacts/api-server/src/routes/__tests__/mountOrder.test.ts` (one new case)

**Interfaces:**
- Consumes (Task 1): `isAllowedReaction`, `reactionAccess`, `summarizeReactions`, `type ReactionSummary` from `../lib/messageReactions.ts`. (Task 2): `chatMessageReactions` from `@workspace/db`. Existing in the file: `participantOf(threadId, userId)` (returns `null` for a malformed id or non-member), `blockedSenderIds(viewerId)`, `isTeacherRole(role)`, `failMessaging(res, err, action, message)`, `UUID`, `createRateLimiter`.
- Produces (consumed by Tasks 5–6):
  - `PUT /api/messaging/threads/:id/messages/:messageId/reaction` body `{ emoji }` → `200 { reactions: ReactionSummary[] }`
  - `DELETE` same path → `200 { reactions: ReactionSummary[] }`
  - every message in `GET /api/messaging/threads/:id/messages` (and the send response, and the inbox `latest`) carries `reactions: ReactionSummary[]`.

- [ ] **Step 1: Write the failing mount-order case**

In `artifacts/api-server/src/routes/__tests__/mountOrder.test.ts`, add directly after the `"guards messaging routes — signed-in only, not teacher-only"` test:

```ts
  it("guards the reaction routes like the rest of /messaging", async () => {
    const path = "/messaging/threads/00000000-0000-0000-0000-000000000001/messages/00000000-0000-0000-0000-000000000002/reaction";
    const put = await fetch(`${base}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji: "👍" }),
    });
    assert.equal(put.status, 401, "PUT reaction must require a token");
    const del = await fetch(`${base}${path}`, { method: "DELETE" });
    assert.equal(del.status, 401, "DELETE reaction must require a token");
  });
```

- [ ] **Step 2: Build and run it to see what it does today**

Run: `cd /home/user/Iqraa/artifacts/api-server && pnpm build && node --experimental-strip-types --test src/routes/__tests__/mountOrder.test.ts 2>&1 | tail -25`
Expected: the new case **passes already** or fails with a 404 — the `/messaging` router's `authMiddleware` answers 401 for any path under it, whether or not the route exists. Record which. If it passes now, it is still worth keeping: after Step 4 it proves the new routes did not escape the guard. If it fails with 404, that is the red state; Step 4 turns it green.

- [ ] **Step 3: Add the route code**

In `artifacts/api-server/src/routes/messaging.ts`:

(a) File header — add after rule 3 (before "Block and report sit on top of both"):

```
 * 4. Reactions are not posts. A reaction is one of six fixed emoji, one per
 *    person per message, and is allowed in an announcement-only group where the
 *    person cannot send (see lib/messageReactions.ts). It is deliberately NOT
 *    gated by studentPostingEnabled — that gate is on POST …/messages only.
 *    Non-teachers see counts; only teacher-role viewers are told who reacted.
```

(b) Imports — add `chatMessageReactions` to the `@workspace/db` import list, and add:

```ts
import { isAllowedReaction, reactionAccess, summarizeReactions, type ReactionSummary } from "../lib/messageReactions.ts";
```

(c) `toClientMessage` — give every message an empty `reactions` so the send response and the inbox `latest` carry the field without extra queries:

```ts
/** A message as sent over the wire: the R2 key never leaves the server, only a time-limited signed URL (see lib/r2.ts). */
async function toClientMessage(row: typeof chatMessages.$inferSelect) {
  const { attachmentKey, ...rest } = row;
  return {
    ...rest,
    attachmentUrl: attachmentKey ? await presignedGetUrl(attachmentKey) : null,
    // Filled in by the list route; a fresh or summarised message has none to show.
    reactions: [] as ReactionSummary[],
  };
}
```

(d) The `GET /messaging/threads/:id/messages` handler — replace the final `res.json(...)` block. Just before `const client = await toClientMessages(messages);` add the reaction query, and change the response:

```ts
    // Reactions for this page, summarised for this viewer. `blocked` is the same
    // set the message filter above used (empty for a teacher), so a non-teacher
    // never sees a reaction from someone they blocked.
    const reactionRows =
      messages.length === 0
        ? []
        : await db
            .select({
              messageId: chatMessageReactions.messageId,
              userId: chatMessageReactions.userId,
              emoji: chatMessageReactions.emoji,
            })
            .from(chatMessageReactions)
            .where(inArray(chatMessageReactions.messageId, messages.map(m => m.id)));
    const reactionsByMessage = summarizeReactions(reactionRows, req.user!.id, {
      viewerIsTeacher: isTeacherRole(req.user!.role),
      hiddenUserIds: blocked,
    });

    const client = await toClientMessages(messages);
    res.json({
      messages: client.map(m => {
        const withSeen = m.senderId === req.user!.id ? { ...m, seen: seenIds.has(m.id) } : m;
        return { ...withSeen, reactions: reactionsByMessage.get(m.id) ?? [] };
      }),
    });
```

(e) The two routes — insert after the `POST /messaging/threads/:id/messages` handler (before the `// ─── Block & report` banner):

```ts
// ─── Reactions ───────────────────────────────────────────────────────────────

/**
 * Keyed by user, like sends. Higher than the 30/min send ceiling because a tap is
 * cheap and a person catching up on an announcement thread may react to several
 * messages in a row; low enough to stop a script.
 */
const reactionLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 60,
  name: "message-react",
  key: req => (req as AuthenticatedRequest).user?.id ?? req.ip ?? "unknown",
});

type ReactionTarget =
  | { status: "ok"; messageId: string; isTeacher: boolean; blocked: Set<string> }
  | { status: "not_found" | "invalid_input" };

/**
 * Looks everything up, then hands the facts to the pure `reactionAccess`. Note
 * what it does NOT consult: `studentPostingEnabled`. Reactions are allowed in
 * announcement-only groups — see the file header, rule 4.
 */
async function resolveReactionTarget(req: AuthenticatedRequest): Promise<ReactionTarget> {
  const threadId = req.params["id"] as string;
  const messageId = req.params["messageId"] as string;
  // A malformed message id would reach Postgres as a uuid cast error and 500.
  if (!UUID.test(messageId)) return { status: "invalid_input" };

  const viewer = req.user!;
  const isTeacher = isTeacherRole(viewer.role);
  const participant = await participantOf(threadId, viewer.id);
  const [thread] = participant
    ? await db.select().from(chatThreads).where(eq(chatThreads.id, threadId)).limit(1)
    : [];
  const [message] = participant
    ? await db
        .select({ id: chatMessages.id, threadId: chatMessages.threadId, senderId: chatMessages.senderId, archivedAt: chatMessages.archivedAt })
        .from(chatMessages)
        .where(eq(chatMessages.id, messageId))
        .limit(1)
    : [];
  const blocked = isTeacher ? new Set<string>() : await blockedSenderIds(viewer.id);

  const verdict = reactionAccess({
    isParticipant: !!participant && !!thread,
    messageInThread: !!message && message.threadId === threadId,
    messageArchived: !!message?.archivedAt,
    viewerIsTeacher: isTeacher,
    viewerBlocksSender: !!message && blocked.has(message.senderId),
    threadType: thread?.type ?? "direct",
    studentPostingEnabled: thread?.studentPostingEnabled ?? false,
  });
  return verdict === "ok" ? { status: "ok", messageId, isTeacher, blocked } : { status: "not_found" };
}

/** The message's reactions as this viewer sees them — the body both routes answer with. */
async function reactionsAfterWrite(target: Extract<ReactionTarget, { status: "ok" }>, viewerId: string): Promise<ReactionSummary[]> {
  const rows = await db
    .select({ messageId: chatMessageReactions.messageId, userId: chatMessageReactions.userId, emoji: chatMessageReactions.emoji })
    .from(chatMessageReactions)
    .where(eq(chatMessageReactions.messageId, target.messageId));
  return (
    summarizeReactions(rows, viewerId, { viewerIsTeacher: target.isTeacher, hiddenUserIds: target.blocked }).get(target.messageId) ?? []
  );
}

function refuseReaction(res: Parameters<Parameters<typeof router.get>[1]>[1], status: "not_found" | "invalid_input"): void {
  if (status === "invalid_input") {
    res.status(400).json({ error: "messageId is not a valid id", code: "invalid_input" });
    return;
  }
  res.status(404).json({ error: "Message not found", code: "not_found" });
}

/**
 * Set or replace the caller's reaction. An upsert on (message, user): replacing
 * is one statement, the same emoji twice changes nothing, and two simultaneous
 * taps cannot both insert. Touches no thread or read state — a reaction does not
 * reorder the inbox, change an unread count, or send a push.
 */
router.put("/messaging/threads/:id/messages/:messageId/reaction", reactionLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const target = await resolveReactionTarget(req);
    if (target.status !== "ok") {
      refuseReaction(res, target.status);
      return;
    }
    const emoji: unknown = req.body?.emoji;
    if (!isAllowedReaction(emoji)) {
      res.status(400).json({ error: "emoji is not an allowed reaction", code: "invalid_reaction" });
      return;
    }
    await db
      .insert(chatMessageReactions)
      .values({ messageId: target.messageId, userId: req.user!.id, emoji })
      .onConflictDoUpdate({
        target: [chatMessageReactions.messageId, chatMessageReactions.userId],
        set: { emoji, updatedAt: new Date() },
      });
    res.json({ reactions: await reactionsAfterWrite(target, req.user!.id) });
  } catch (err) {
    failMessaging(res, err, "set reaction", "Failed to save reaction");
  }
});

/** Remove the caller's reaction. Idempotent: removing one that is not there is still 200, so a retry after a lost response is harmless. */
router.delete("/messaging/threads/:id/messages/:messageId/reaction", reactionLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const target = await resolveReactionTarget(req);
    if (target.status !== "ok") {
      refuseReaction(res, target.status);
      return;
    }
    await db
      .delete(chatMessageReactions)
      .where(and(eq(chatMessageReactions.messageId, target.messageId), eq(chatMessageReactions.userId, req.user!.id)));
    res.json({ reactions: await reactionsAfterWrite(target, req.user!.id) });
  } catch (err) {
    failMessaging(res, err, "remove reaction", "Failed to remove reaction");
  }
});
```

- [ ] **Step 4: Typecheck, rebuild, run the API suite**

Run:
```bash
cd /home/user/Iqraa && pnpm run typecheck
cd artifacts/api-server && pnpm build && pnpm test 2>&1 | tail -30
```
Expected: typecheck clean; the whole API suite passes, including the new mount-order case and Task 1's tests; the mount-order suite is **not** skipped (the bundle was just built). If `typecheck` complains about `onConflictDoUpdate`'s `target` array, the drizzle version wants `target: [col1, col2]` of columns — it should accept exactly this; if not, read the error rather than casting.

- [ ] **Step 5: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/api-server/src/routes/messaging.ts artifacts/api-server/src/routes/__tests__/mountOrder.test.ts
git commit -F - <<'EOF'
Reactions: PUT/DELETE routes and per-message reactions in the list

Allowed in announcement-only groups by design (header rule 4). Blocked
users' reactions are hidden from non-teachers; only teachers get userIds.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019vPETG2XEpBi5PM2oYMWE3
EOF
```

---

### Task 4: App pure logic — toggle, poll merge, emoji parity

**Files:**
- Create: `artifacts/mobile/services/messageReactions.ts`
- Modify: `artifacts/mobile/services/messageMerge.ts`
- Test: `artifacts/mobile/services/__tests__/messageReactions.test.ts` (create), `artifacts/mobile/services/__tests__/mergeNewMessages.test.ts` (append), `artifacts/mobile/services/__tests__/reactionEmojiParity.test.ts` (create)

**Interfaces:**
- Consumes: nothing from earlier tasks at runtime. The parity test reads `artifacts/api-server/src/lib/messageReactions.ts` (Task 1) as text.
- Produces (used by Tasks 5–6):
  - `messageReactions.ts`: `REACTION_EMOJI` (same single-line declaration as the API's), `interface ChatReaction { emoji: string; count: number; mine: boolean; userIds?: string[] }`, `toggleReaction(current: readonly ChatReaction[], emoji: string, viewerId?: string): ChatReaction[]`, `myReaction(reactions: readonly ChatReaction[] | undefined): string | null`
  - `messageMerge.ts`: `mergeNewMessages` now also adopts changed `reactions`; new export `sameReactions(a?, b?): boolean`.

- [ ] **Step 1: Write the failing tests**

Create `artifacts/mobile/services/__tests__/messageReactions.test.ts`:

```ts
/**
 * What this guards: the optimistic reaction update. A tap must feel instant, so
 * the app predicts what the server will answer — and the prediction has to be
 * the same rule the server applies (one reaction per person: tapping your own
 * removes it, tapping another moves it).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { REACTION_EMOJI, myReaction, toggleReaction, type ChatReaction } from '../messageReactions.ts';

const chip = (emoji: string, count: number, mine = false, userIds?: string[]): ChatReaction =>
  userIds ? { emoji, count, mine, userIds } : { emoji, count, mine };

describe('toggleReaction', () => {
  it('adds a first reaction', () => {
    assert.deepEqual(toggleReaction([], '👍'), [chip('👍', 1, true)]);
  });

  it('joins an emoji others already used', () => {
    assert.deepEqual(toggleReaction([chip('👍', 2)], '👍'), [chip('👍', 3, true)]);
  });

  it('removes your own when you tap it again, dropping a chip that reaches zero', () => {
    assert.deepEqual(toggleReaction([chip('👍', 1, true)], '👍'), []);
    assert.deepEqual(toggleReaction([chip('👍', 3, true)], '👍'), [chip('👍', 2)]);
  });

  it('moves your mark when you tap a different emoji', () => {
    const out = toggleReaction([chip('👍', 1, true), chip('🙏', 2)], '🙏');
    assert.deepEqual(out, [chip('🙏', 3, true)]);
  });

  it('keeps chips in the fixed emoji order, not the order they were added', () => {
    const out = toggleReaction([chip('🙏', 1)], '👍');
    assert.deepEqual(out.map(c => c.emoji), ['👍', '🙏']);
    assert.deepEqual(REACTION_EMOJI.slice(0, 1), ['👍']);
  });

  it('keeps userIds in step for a teacher, when told who is tapping', () => {
    const out = toggleReaction([chip('👍', 2, true, ['me', 'x'])], '😂', 'me');
    assert.deepEqual(out, [chip('👍', 1, false, ['x']), chip('😂', 1, true, ['me'])]);
  });

  it('never mutates its input', () => {
    const input = [chip('👍', 1, true, ['me'])];
    const snapshot = JSON.parse(JSON.stringify(input));
    toggleReaction(input, '🙏', 'me');
    assert.deepEqual(input, snapshot);
  });
});

describe('myReaction', () => {
  it('finds the viewer\'s own emoji, or null', () => {
    assert.equal(myReaction([chip('👍', 1), chip('🙏', 1, true)]), '🙏');
    assert.equal(myReaction([chip('👍', 1)]), null);
    assert.equal(myReaction(undefined), null);
  });
});
```

Append to `artifacts/mobile/services/__tests__/mergeNewMessages.test.ts`:

```ts
describe('mergeNewMessages — reactions', () => {
  // One declared shape for every literal below: the generic merge infers its
  // type from both arguments, and `{ id }` next to `{ id, reactions }` would not typecheck.
  type M = { id: string; seen?: boolean; reactions?: { emoji: string; count: number; mine: boolean; userIds?: string[] }[] };
  const r = (emoji: string, count: number, mine = false) => ({ emoji, count, mine });

  it('adopts changed reactions on a message already on screen', () => {
    const current: M[] = [{ id: 'a', reactions: [r('👍', 1)] }];
    const polled: M[] = [{ id: 'a', reactions: [r('👍', 2), r('🙏', 1)] }];
    assert.deepEqual(mergeNewMessages(current, polled), [{ id: 'a', reactions: [r('👍', 2), r('🙏', 1)] }]);
  });

  it('keeps the same array reference when reactions did not change', () => {
    const current: M[] = [{ id: 'a', reactions: [r('👍', 1, true)] }];
    const polled: M[] = [{ id: 'a', reactions: [r('👍', 1, true)] }];
    assert.equal(mergeNewMessages(current, polled), current);
  });

  it('notices the same chip held by different people (teacher view)', () => {
    const current: M[] = [{ id: 'a', reactions: [{ emoji: '👍', count: 1, mine: false, userIds: ['x'] }] }];
    const polled: M[] = [{ id: 'a', reactions: [{ emoji: '👍', count: 1, mine: false, userIds: ['y'] }] }];
    assert.notEqual(mergeNewMessages(current, polled), current);
  });

  it('treats a poll without a reactions field (older API build) as "no news", not "all removed"', () => {
    const current: M[] = [{ id: 'a', reactions: [r('👍', 1)] }];
    const polled: M[] = [{ id: 'a' }];
    assert.equal(mergeNewMessages(current, polled), current);
  });

  it('clears reactions when the poll says there are none', () => {
    const current: M[] = [{ id: 'a', reactions: [r('👍', 1)] }];
    const polled: M[] = [{ id: 'a', reactions: [] }];
    assert.deepEqual(mergeNewMessages(current, polled), [{ id: 'a', reactions: [] }]);
  });

  it('applies reactions and new messages together, leaving other held messages alone', () => {
    const current: M[] = [{ id: 'b', reactions: [r('👍', 1)] }, { id: 'a', reactions: [r('🙏', 1)] }];
    const polled: M[] = [{ id: 'c', reactions: [] }, { id: 'b', reactions: [r('👍', 2)] }];
    const merged = mergeNewMessages(current, polled);
    assert.deepEqual(merged.map(m => m.id), ['c', 'b', 'a']);
    assert.deepEqual(merged[1]!.reactions, [r('👍', 2)]);
    assert.equal(merged[2], current[1]);
  });

  it('still adopts a new seen alongside reactions', () => {
    const current: M[] = [{ id: 'a', seen: false, reactions: [r('👍', 1)] }];
    const polled: M[] = [{ id: 'a', seen: true, reactions: [r('👍', 2)] }];
    assert.deepEqual(mergeNewMessages(current, polled), [{ id: 'a', seen: true, reactions: [r('👍', 2)] }]);
  });
});
```

Create `artifacts/mobile/services/__tests__/reactionEmojiParity.test.ts`:

```ts
/**
 * What this guards: the emoji list lives in two places — the API (which rejects
 * anything else) and the app (which draws the picker). They are separate
 * packages, so nothing but this test notices when one moves without the other.
 * The result of drift is not a crash: a new app emoji would just be a 400 in a
 * teacher's hands.
 *
 * Reads both files as text instead of importing the API module, so the app's
 * typecheck never has to follow an import into another package.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const declaration = (url: URL): string[] => {
  const src = readFileSync(url, 'utf8');
  const m = src.match(/export const REACTION_EMOJI = (\[[^\]]*\])/);
  assert.ok(m, `no single-line "export const REACTION_EMOJI = [...]" in ${url.pathname}`);
  // Quote style differs between the two packages; the values must not.
  return JSON.parse(m![1]!.replace(/'/g, '"')) as string[];
};

describe('REACTION_EMOJI parity', () => {
  it('is the same six emoji, in the same order, in the API and the app', () => {
    const api = declaration(new URL('../../../api-server/src/lib/messageReactions.ts', import.meta.url));
    const app = declaration(new URL('../messageReactions.ts', import.meta.url));
    assert.equal(api.length, 6);
    assert.deepEqual(app, api);
    assert.equal(app[1], '❤️', 'the heart must be U+2764 U+FE0F');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd /home/user/Iqraa/artifacts/mobile && pnpm test 2>&1 | tail -30`
Expected: the three touched files fail — `messageReactions.ts` not found, and the new `mergeNewMessages` reaction cases fail (current code ignores `reactions`). Everything else still passes.

- [ ] **Step 3: Write the app pure module**

Create `artifacts/mobile/services/messageReactions.ts`:

```ts
/**
 * Reactions on a chat message — the pure half, split out of messaging.ts for the
 * reason messageMerge.ts documents: messaging.ts imports `expo-image-picker`, so
 * nothing in it can be loaded by bare `node --test`. No RN or expo imports here.
 *
 * `REACTION_EMOJI` is mirrored from artifacts/api-server/src/lib/messageReactions.ts.
 * Keep the declaration on ONE line, identical in content (quote style aside):
 * reactionEmojiParity.test.ts reads both files and fails if they drift.
 */
export const REACTION_EMOJI = ['👍', '❤️', '😂', '😮', '👏', '🙏'] as const;

export interface ChatReaction {
  emoji: string;
  count: number;
  /** The signed-in viewer's own reaction is in this chip. */
  mine: boolean;
  /** Teacher-role viewers only: who. */
  userIds?: string[];
}

const rank = (emoji: string): number => {
  const i = (REACTION_EMOJI as readonly string[]).indexOf(emoji);
  return i === -1 ? REACTION_EMOJI.length : i;
};

/** The emoji the viewer has put on this message, if any. */
export function myReaction(reactions: readonly ChatReaction[] | undefined): string | null {
  return reactions?.find(r => r.mine)?.emoji ?? null;
}

/**
 * What the chips will look like after the viewer taps `emoji` — applied at once,
 * then replaced by the server's answer. Same rule as the server: one reaction per
 * person, so tapping your own removes it and tapping another moves it.
 * `viewerId` keeps a teacher's `userIds` in step; without it they are left as they
 * were (the server's reply corrects them). Never mutates `current`.
 */
export function toggleReaction(current: readonly ChatReaction[], emoji: string, viewerId?: string): ChatReaction[] {
  const had = myReaction(current);
  const withoutMine: ChatReaction[] = current
    .map(r =>
      r.mine
        ? { ...r, count: r.count - 1, mine: false, ...(r.userIds ? { userIds: r.userIds.filter(id => id !== viewerId) } : {}) }
        : { ...r, ...(r.userIds ? { userIds: [...r.userIds] } : {}) },
    )
    .filter(r => r.count > 0);

  if (had !== emoji) {
    const target = withoutMine.find(r => r.emoji === emoji);
    if (target) {
      target.count += 1;
      target.mine = true;
      if (target.userIds && viewerId) target.userIds = [...target.userIds, viewerId].sort();
    } else {
      withoutMine.push({ emoji, count: 1, mine: true, ...(viewerId ? { userIds: [viewerId] } : {}) });
    }
  }
  return withoutMine.sort((a, b) => rank(a.emoji) - rank(b.emoji));
}
```

> Note on the `userIds` handling: a non-teacher's chips carry no `userIds`, and `viewerId` is only passed by the screen for teachers (Task 6), so `{ userIds: [viewerId] }` is added only where the viewer is a teacher. Do not "simplify" it away; the test `keeps userIds in step for a teacher` pins it.

- [ ] **Step 4: Extend the poll merge**

Replace the body of `artifacts/mobile/services/messageMerge.ts` below its doc comment (keep the comment, add the bullet shown). New bullet to add to the doc comment's list:

```
 * - A message already held also takes the poll's `reactions` when they differ
 *   (by emoji, count, mine and who) — the poll is the only way someone else's
 *   reaction reaches a thread that is already open. A poll that carries no
 *   `reactions` field at all (an older API build) is "no news", not "all
 *   removed". The poll fetches only the newest page, so reactions on older
 *   scrolled-back messages refresh when the thread is reopened.
```

Code:

```ts
interface ReactionLike {
  emoji: string;
  count: number;
  mine: boolean;
  userIds?: string[];
}

/** Same chips, same counts, same own mark, same people. The server's order is stable, so position matters. */
export function sameReactions(a?: readonly ReactionLike[], b?: readonly ReactionLike[]): boolean {
  const x = a ?? [];
  const y = b ?? [];
  if (x.length !== y.length) return false;
  return x.every((r, i) => {
    const o = y[i]!;
    return r.emoji === o.emoji && r.count === o.count && r.mine === o.mine && (r.userIds ?? []).join(',') === (o.userIds ?? []).join(',');
  });
}

export function mergeNewMessages<T extends { id: string; seen?: boolean; reactions?: ReactionLike[] }>(current: T[], polled: T[]): T[] {
  const known = new Set(current.map(m => m.id));
  const fresh = polled.filter(m => !known.has(m.id));
  const polledById = new Map(polled.map(m => [m.id, m] as const));
  let changed = false;
  const held = current.map(m => {
    const p = polledById.get(m.id);
    if (!p) return m;
    let next = m;
    if (!m.seen && p.seen) next = { ...next, seen: true };
    if (p.reactions !== undefined && !sameReactions(m.reactions, p.reactions)) next = { ...next, reactions: p.reactions };
    if (next !== m) changed = true;
    return next;
  });
  if (fresh.length === 0 && !changed) return current;
  return fresh.length === 0 ? held : [...fresh, ...held];
}
```

- [ ] **Step 5: Run to verify they pass**

Run: `cd /home/user/Iqraa/artifacts/mobile && pnpm test 2>&1 | tail -30`
Expected: all green — the new files, the appended reaction cases, **and every pre-existing `mergeNewMessages` / `seen` test unchanged**. If an old `seen` test fails, the rewrite changed behaviour: fix the code, not the test.

- [ ] **Step 6: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/mobile/services/messageReactions.ts artifacts/mobile/services/messageMerge.ts artifacts/mobile/services/__tests__
git commit -F - <<'EOF'
Reactions: optimistic toggle, poll merge, API/app emoji parity test (app)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019vPETG2XEpBi5PM2oYMWE3
EOF
```

---

### Task 5: App service calls, strings and bubble chips

**Files:**
- Modify: `artifacts/mobile/services/messaging.ts`
- Modify: `artifacts/mobile/services/i18n.ts` (Arabic block near `messageSeen`, English block near its `messageSeen`)
- Modify: `artifacts/mobile/components/ui/MessageBubble.tsx`

**Interfaces:**
- Consumes (Task 4): `ChatReaction` from `./messageReactions`. (Task 3): the two routes.
- Produces (used by Task 6):
  - `setReaction(threadId: string, messageId: string, emoji: string): Promise<ChatReaction[]>`
  - `clearReaction(threadId: string, messageId: string): Promise<ChatReaction[]>`
  - `ChatMessage.reactions?: ChatReaction[]`
  - `MessageBubble` props `reactions?: ChatReaction[]`, `onReactionPress?: (emoji: string) => void`
  - i18n keys: `messageReactTitle`, `messageReactionsList`, `messageReportAction`, `messageReactorUnknown`, `messageReactionFailed`, and the function key `messageReactionChipLabel(emoji, count, mine)`.

- [ ] **Step 1: Service functions and type**

In `artifacts/mobile/services/messaging.ts`, add near the top imports `import type { ChatReaction } from './messageReactions';`, extend `ChatMessage`:

```ts
  /** Absent on older API builds — read it as []. */
  reactions?: ChatReaction[];
```

and add after `sendMessage`:

```ts
/** Put (or replace) your reaction on a message. Answers with that message's fresh chips. */
export async function setReaction(threadId: string, messageId: string, emoji: string): Promise<ChatReaction[]> {
  const res = await apiFetch(`/messaging/threads/${threadId}/messages/${messageId}/reaction`, {
    method: 'PUT',
    body: JSON.stringify({ emoji }),
  });
  const data = await readJson<{ reactions: ChatReaction[] }>(res, 'Reacting to message');
  return data.reactions;
}

/** Take your reaction off a message. Safe to repeat. */
export async function clearReaction(threadId: string, messageId: string): Promise<ChatReaction[]> {
  const res = await apiFetch(`/messaging/threads/${threadId}/messages/${messageId}/reaction`, { method: 'DELETE' });
  const data = await readJson<{ reactions: ChatReaction[] }>(res, 'Removing reaction');
  return data.reactions;
}
```

- [ ] **Step 2: Strings**

In `artifacts/mobile/services/i18n.ts`, directly after the Arabic `messageSeen: "شوهدت",` line add:

```ts
    messageReactTitle: 'تفاعل مع الرسالة',
    messageReactionsList: 'التفاعلات',
    messageReportAction: 'إبلاغ',
    messageReactorUnknown: 'مستخدم',
    messageReactionFailed: 'تعذّر حفظ التفاعل. حاول مرة أخرى.',
    messageReactionChipLabel: (emoji: string, count: number, mine: boolean) =>
      `${emoji} ${count} — ${mine ? 'إزالة تفاعلك' : 'تفاعل بنفس الرمز'}`,
```

and directly after the English `messageSeen: "Seen",` line add:

```ts
    messageReactTitle: 'React to message',
    messageReactionsList: 'Reactions',
    messageReportAction: 'Report',
    messageReactorUnknown: 'User',
    messageReactionFailed: 'Could not save your reaction. Try again.',
    messageReactionChipLabel: (emoji: string, count: number, mine: boolean) =>
      `${emoji} ${count} — ${mine ? 'remove your reaction' : 'react with the same emoji'}`,
```

- [ ] **Step 3: Bubble chips**

Rewrite `artifacts/mobile/components/ui/MessageBubble.tsx` so the chips sit **under** the bubble. Changes:

(a) Imports — add `Pressable` to the `react-native` import; add `import type { ChatReaction } from '@/services/messageReactions';`.

(b) `Props` — add:

```ts
  /** Chips under the bubble. Tapping one toggles the viewer's own reaction (the screen decides what that means). */
  reactions?: ChatReaction[];
  onReactionPress?: (emoji: string) => void;
  /** Spoken label for a chip — passed in so this component needs no translation hook. */
  reactionLabel?: (r: ChatReaction) => string;
```

(c) A small chip row component in the same file:

```tsx
function ReactionChips({
  reactions, colors, isRTL, onPress, label,
}: {
  reactions: ChatReaction[];
  colors: Colors;
  isRTL: boolean;
  onPress?: (emoji: string) => void;
  label?: (r: ChatReaction) => string;
}) {
  if (reactions.length === 0) return null;
  return (
    <View style={styles.chips}>
      {reactions.map(r => (
        <Pressable
          key={r.emoji}
          onPress={() => onPress?.(r.emoji)}
          accessibilityRole="button"
          accessibilityLabel={label?.(r)}
          hitSlop={6}
          style={[
            styles.chip,
            {
              backgroundColor: r.mine ? colors.secondary : colors.card,
              borderColor: r.mine ? colors.primary : colors.border,
            },
          ]}
        >
          <Text style={styles.chipEmoji}>{r.emoji}</Text>
          <Text style={[styles.chipCount, { color: r.mine ? colors.primary : colors.mutedForeground }]}>
            {r.count.toLocaleString(isRTL ? AR_LATIN : undefined)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
```

(d) Layout — each branch wraps the bubble in a column that carries the width cap, with the chips after it. Own branch becomes:

```tsx
    return (
      <View style={styles.rowOwn}>
        <View style={[styles.column, { alignItems: 'flex-end' }]}>
          <View style={[styles.bubble, { backgroundColor: colors.primary, borderRadius: 18 }]}>
            {/* …existing image / body / timestamp children, unchanged… */}
          </View>
          <ReactionChips reactions={reactions ?? []} colors={colors} isRTL={isRTL} onPress={onReactionPress} label={reactionLabel} />
        </View>
      </View>
    );
```

and the other-person branch:

```tsx
    <View style={styles.rowOther}>
      <Avatar firstName={senderFirstName ?? '?'} lastName={senderLastName} size={30} colors={colors} />
      <View style={[styles.column, { alignItems: 'flex-start' }]}>
        <View style={[styles.bubble, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 18 }]}>
          {/* …existing senderName / image / body / timestamp children, unchanged… */}
        </View>
        <ReactionChips reactions={reactions ?? []} colors={colors} isRTL={isRTL} onPress={onReactionPress} label={reactionLabel} />
      </View>
    </View>
```

(e) Styles — the width cap moves from the bubble to the column (the bubble would otherwise be 78% of 78%):

```ts
  column: { maxWidth: '78%' },
  bubble: { padding: 12, paddingHorizontal: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  chipEmoji: { fontSize: 14, lineHeight: 20 },
  chipCount: { fontSize: 12, lineHeight: 18, fontFamily: 'Almarai_400Regular' },
```

(remove `maxWidth: '78%'` from `bubble`; leave every other existing style as is).

- [ ] **Step 4: Typecheck and run the mobile tests**

Run: `cd /home/user/Iqraa && pnpm run typecheck && cd artifacts/mobile && pnpm test 2>&1 | tail -8`
Expected: clean typecheck (this also proves both translation blocks accept the new keys — `TranslationKey` is `keyof translations.en`, and a key present in one language only is a type error elsewhere); all mobile tests pass.

- [ ] **Step 5: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/mobile/services/messaging.ts artifacts/mobile/services/i18n.ts artifacts/mobile/components/ui/MessageBubble.tsx
git commit -F - <<'EOF'
Reactions: service calls, strings, and chips under the bubble (app)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019vPETG2XEpBi5PM2oYMWE3
EOF
```

---

### Task 6: Thread screen — message sheet, optimistic toggle, poll filtering

**Files:**
- Modify: `artifacts/mobile/app/messaging/[threadId].tsx`

**Interfaces:**
- Consumes (Tasks 4–5): `toggleReaction`, `myReaction`, `REACTION_EMOJI`, `ChatReaction` from `@/services/messageReactions`; `setReaction`, `clearReaction` from `@/services/messaging`; `MessageBubble` props `reactions`, `onReactionPress`, `reactionLabel`; i18n keys from Task 5; existing in the screen: `messages`/`setMessages`, `participantsById`, `isTeacher`, `isRTL`, `setError`, `apiErrorMessage`, `setReportTarget`, `Haptics`, `colors`, `align`, `styles.modalBackdrop/menuCard/modalTitle/menuRow/menuText`.
- Produces: the user-facing behaviour (no later task depends on its names).

There is no React Native test runner in this repo, so this task is verified by typecheck here and by the running app in Task 7. Keep the logic in the already-tested pure helpers; the screen only wires them.

- [ ] **Step 1: Imports and state**

Add `useRef` is already imported. Extend the imports:

```ts
import { clearReaction, setReaction, /* …existing messaging imports… */ } from '@/services/messaging';
import { REACTION_EMOJI, myReaction, toggleReaction, type ChatReaction } from '@/services/messageReactions';
```

(merge `clearReaction` and `setReaction` into the existing `@/services/messaging` import list rather than adding a second import.)

State, next to `reportTarget`:

```ts
  // The message whose reaction sheet is open. An id, not the message: the sheet
  // re-reads it from `messages` so its highlighted emoji follows the optimistic update.
  const [sheetMessageId, setSheetMessageId] = useState<string | null>(null);
  // Messages with a reaction request in flight. Their reactions are ignored by the
  // poll (so a poll that started before the PUT cannot undo the tap) and a second
  // tap on them is ignored until the first settles.
  const pendingReactions = useRef(new Set<string>());
```

- [ ] **Step 2: Keep the poll from undoing an in-flight tap**

In `refresh`, replace `setMessages(prev => mergeNewMessages(prev, polled));` with:

```ts
      // A message mid-reaction keeps what the tap put on screen; `reactions: undefined`
      // is "no news" to mergeNewMessages.
      const safe = polled.map(m => (pendingReactions.current.has(m.id) ? { ...m, reactions: undefined } : m));
      setMessages(prev => mergeNewMessages(prev, safe));
```

- [ ] **Step 3: The toggle**

Add beside `submitReport`:

```ts
  const reactTo = async (messageId: string, emoji: string) => {
    if (!threadId || !user || pendingReactions.current.has(messageId)) return;
    const before = messages.find(m => m.id === messageId);
    if (!before) return;
    const prior = before.reactions ?? [];
    const removing = myReaction(prior) === emoji;
    const put = (reactions: ChatReaction[]) =>
      setMessages(prev => prev.map(m => (m.id === messageId ? { ...m, reactions } : m)));

    pendingReactions.current.add(messageId);
    // Only a teacher's chips carry userIds, so only a teacher's tap needs the id.
    put(toggleReaction(prior, emoji, isTeacher ? user.id : undefined));
    Haptics.selectionAsync();
    try {
      put(removing ? await clearReaction(threadId, messageId) : await setReaction(threadId, messageId, emoji));
    } catch (e) {
      put(prior);
      setError(apiErrorMessage(e, 'messageReactionFailed', t));
    } finally {
      pendingReactions.current.delete(messageId);
    }
  };
```

> Known, accepted: a poll that began before the request settled but resolves after `pendingReactions` is cleared can briefly show the old chips until the next poll (10 s). Not worth a sequence-number scheme.

- [ ] **Step 4: Bubble wiring and long-press**

In the `FlatList` `renderItem`, replace the `onLongPress` handler and add the new bubble props:

```tsx
                onLongPress={() => {
                  Haptics.selectionAsync();
                  setSheetMessageId(item.id);
                }}
```

and on `<MessageBubble …>` add:

```tsx
                  reactions={item.reactions}
                  onReactionPress={emoji => void reactTo(item.id, emoji)}
                  reactionLabel={r => t('messageReactionChipLabel', r.emoji, r.count, r.mine)}
```

- [ ] **Step 5: The sheet**

Derived values — add next to `isTeacher`:

```ts
  const sheetMessage = sheetMessageId ? messages.find(m => m.id === sheetMessageId) ?? null : null;
  const sheetMine = myReaction(sheetMessage?.reactions);
```

Add this `Modal` immediately **before** the `{/* ─── Report reason picker … */}` modal:

```tsx
      {/* ─── Message sheet, opened by long-pressing any message: react, or report someone else's ─── */}
      <Modal visible={!!sheetMessage} transparent animationType="fade" onRequestClose={() => setSheetMessageId(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSheetMessageId(null)}>
          {sheetMessage ? (
            <View style={[styles.menuCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', textAlign: align }]}>
                {t('messageReactTitle')}
              </Text>
              <View style={styles.emojiRow}>
                {REACTION_EMOJI.map(emoji => (
                  <Pressable
                    key={emoji}
                    accessibilityRole="button"
                    accessibilityLabel={emoji}
                    onPress={() => {
                      const id = sheetMessage.id;
                      setSheetMessageId(null);
                      void reactTo(id, emoji);
                    }}
                    style={[styles.emojiBtn, sheetMine === emoji && { backgroundColor: colors.secondary }]}
                  >
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Who reacted — teachers only; the server sends userIds to no one else. */}
              {isTeacher && (sheetMessage.reactions ?? []).length > 0 ? (
                <View>
                  <Text style={[styles.modalTitle, { color: colors.mutedForeground, fontFamily: 'ReadexPro_600SemiBold', textAlign: align }]}>
                    {t('messageReactionsList')}
                  </Text>
                  {(sheetMessage.reactions ?? []).map(r => (
                    <Text
                      key={r.emoji}
                      style={[styles.reactorLine, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: align }]}
                    >
                      {`${r.emoji}  ${(r.userIds ?? [])
                        .map(id => {
                          const p = participantsById.get(id);
                          return p ? `${p.firstName} ${p.lastName}`.trim() : t('messageReactorUnknown');
                        })
                        .join(isRTL ? '، ' : ', ')}`}
                    </Text>
                  ))}
                </View>
              ) : null}

              {/* Reporting stays one tap away; the report modal itself is unchanged. */}
              {sheetMessage.senderId !== user?.id ? (
                <Pressable
                  onPress={() => {
                    const target = { messageId: sheetMessage.id, senderId: sheetMessage.senderId };
                    setSheetMessageId(null);
                    // Two Modals cannot swap in the same tick on iOS — the second is dropped.
                    setTimeout(() => setReportTarget(target), 250);
                  }}
                  style={styles.menuRow}
                >
                  <Ionicons name="flag-outline" size={18} color={colors.destructive} />
                  <Text style={[styles.menuText, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
                    {t('messageReportAction')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </Pressable>
      </Modal>
```

Styles — add to the `StyleSheet.create` block:

```ts
  emojiRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingVertical: 8 },
  emojiBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 24 },
  reactorLine: { fontSize: 13, lineHeight: 20, paddingHorizontal: 10, paddingVertical: 2 },
```

Also update the file's header comment where it says report is "via long-press": long-press now opens a sheet with the emoji row and the report action.

- [ ] **Step 6: Typecheck and test**

Run: `cd /home/user/Iqraa && pnpm run typecheck && cd artifacts/mobile && pnpm test 2>&1 | tail -8`
Expected: clean; all mobile tests pass. If `Ionicons` rejects `flag-outline`, use a name the file already uses (`grep -n 'name="' app/messaging/\[threadId\].tsx`); do not cast.

- [ ] **Step 7: Commit**

```bash
cd /home/user/Iqraa
git add "artifacts/mobile/app/messaging/[threadId].tsx"
git commit -F - <<'EOF'
Reactions: long-press sheet, optimistic toggle, poll-safe (thread screen)

Long-press now opens a sheet (emoji row, plus report on others' messages)
instead of jumping straight to the report picker.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019vPETG2XEpBi5PM2oYMWE3
EOF
```

---

### Task 7: Verify on the running system, STATUS.md, PR

**Files:**
- Modify: `STATUS.md`
- (no code changes expected; if verification finds a defect, fix it test-first in the task that owns it and say so)

**Interfaces:**
- Consumes: everything above; the throwaway Postgres from Task 2 Step 4 (`/var/tmp/iqraa-pg.path`, port 54329, database `iqraa_test`, all migrations applied).
- Produces: observed evidence recorded in the PR body, a `STATUS.md` entry, a pushed branch.

REQUIRED SUB-SKILL: follow `verification-before-completion` — no "works" claim without the command output in front of you.

- [ ] **Step 1: Seed a thread and boot the API**

```bash
PSQL="psql -h 127.0.0.1 -p 54329 -U postgres -d iqraa_test -v ON_ERROR_STOP=1 -q"
$PSQL <<'SQL'
insert into users (id, first_name, last_name, email, role) values
 ('00000000-0000-4000-8000-0000000000a1','Tea','Cher','t@x.test','teacher'),
 ('00000000-0000-4000-8000-0000000000a2','Stu','One','s1@x.test','student'),
 ('00000000-0000-4000-8000-0000000000a3','Stu','Two','s2@x.test','student');
insert into chat_threads (id, type, title, title_ar, created_by, student_posting_enabled) values
 ('00000000-0000-4000-8000-0000000000b1','custom_group','Test','تجربة','00000000-0000-4000-8000-0000000000a1', false);
insert into chat_participants (thread_id, user_id) values
 ('00000000-0000-4000-8000-0000000000b1','00000000-0000-4000-8000-0000000000a1'),
 ('00000000-0000-4000-8000-0000000000b1','00000000-0000-4000-8000-0000000000a2'),
 ('00000000-0000-4000-8000-0000000000b1','00000000-0000-4000-8000-0000000000a3');
insert into chat_messages (id, thread_id, sender_id, body) values
 ('00000000-0000-4000-8000-0000000000c1','00000000-0000-4000-8000-0000000000b1','00000000-0000-4000-8000-0000000000a1','الاختبار الأحد');
SQL
cd /home/user/Iqraa/artifacts/api-server && pnpm build
export DATABASE_URL=postgres://postgres@127.0.0.1:54329/iqraa_test SESSION_SECRET=local-verification-secret-padded-past-32-characters OPENAI_API_KEY=sk-test-placeholder PORT=8099
node dist/index.mjs > /var/tmp/iqraa-api.log 2>&1 &
sleep 4; curl -s http://127.0.0.1:8099/api/healthz
```
Expected: seed succeeds (if a `NOT NULL` column without default blocks an insert, add it to the seed — that is a seed fix, not a code bug); `healthz` returns `{"status":"ok"…}`.

- [ ] **Step 2: Mint tokens and exercise the routes**

```bash
cd /home/user/Iqraa/artifacts/api-server
tok() { node -e "console.log(require('jsonwebtoken').sign({sub:'$1',email:'x@x.test',role:'$2',type:'access'}, process.env.SESSION_SECRET,{algorithm:'HS256'}))"; }
T=$(tok 00000000-0000-4000-8000-0000000000a1 teacher)
S1=$(tok 00000000-0000-4000-8000-0000000000a2 student)
S2=$(tok 00000000-0000-4000-8000-0000000000a3 student)
B=http://127.0.0.1:8099/api/messaging/threads/00000000-0000-4000-8000-0000000000b1
M=$B/messages/00000000-0000-4000-8000-0000000000c1/reaction
H='Content-Type: application/json'
```

Run and record the output of each, with the expectation after it:

1. Student, **posting off**, can react: `curl -s -X PUT $M -H "Authorization: Bearer $S1" -H "$H" -d '{"emoji":"👍"}'` → `200 {"reactions":[{"emoji":"👍","count":1,"mine":true}]}` (no `userIds`). And confirm posting is still refused: `curl -s -X POST $B/messages -H "Authorization: Bearer $S1" -H "$H" -d '{"body":"hi"}'` → `403 … group_read_only`.
2. Second student, same emoji: `PUT … $S2` → `count:2, mine:true`.
3. Replace: `PUT … $S1 -d '{"emoji":"🙏"}'` → two chips, `👍` count 1 (mine false) and `🙏` count 1 (mine true); the DB has one row for that user: `$PSQL -c "select user_id, emoji from chat_message_reactions order by 1"`.
4. Idempotent: repeat step 3's request → identical body, still one row per user.
5. Teacher sees who: `GET $B/messages -H "Authorization: Bearer $T"` → the message carries `reactions` with `userIds`; the same GET as `$S1` has no `userIds`.
6. Bad inputs: `-d '{"emoji":"👎"}'` → `400 invalid_reaction`; `…/messages/not-a-uuid/reaction` → `400 invalid_input`; a message id that is not in this thread → `404 not_found`; a token for a user who is not a participant (insert one more user and mint a token) → `404`.
7. Remove, twice: `DELETE $M -H "Authorization: Bearer $S1"` → 200 both times; the second changes nothing.
8. Nothing else moved: before step 1 and after step 7 run `$PSQL -c "select updated_at from chat_threads"` and `$PSQL -c "select user_id, last_read_at from chat_participants order by 1"` — the `updated_at` values are identical, and the only `last_read_at` changes are from the `GET`s in step 5 (a read marks read; reactions did not).
9. Block rule: as `$S2`, `POST /api/messaging/blocks -d '{"blockedUserId":"…a2"}'`, then `GET $B/messages` as `$S2` → the teacher's message still shows, `$S1`'s reaction is gone from the counts; as the teacher, it is still there.
10. Rate limit: loop 65 `PUT`s as `$S2` → the 61st onward is `429`.

If any expectation fails: stop, apply `systematic-debugging`, fix test-first in the owning task, rebuild (`pnpm build`, restart the API), and rerun from step 1 of this list.

- [ ] **Step 3: The app, as far as this environment allows**

Try the web build against this API (`EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8099/api`, `pnpm run dev:mobile:web`, then drive it with the preinstalled Chromium/Playwright — see the `run` skill and `docs/demo-checklist.md`). Sign-in needs a user with a password hash, which the seed above does not create; if getting an authenticated session in the browser costs more than a short attempt, **stop and report the UI as not exercised in a browser** — do not claim it works from typecheck alone. What must be checked if it does run: long-press opens the sheet; picking an emoji shows a chip at once; the chip is on the bubble's own edge in RTL; a second session sees it within ~10 s without reopening; the report row opens the unchanged report picker.

- [ ] **Step 4: Stop the servers and clean up**

```bash
kill %1 2>/dev/null; pkill -f "node dist/index.mjs" 2>/dev/null
PGD=$(cat /var/tmp/iqraa-pg.path)
runuser -u postgres -- /usr/lib/postgresql/16/bin/pg_ctl -D "$PGD/data" stop -m fast
rm -rf "$PGD" /var/tmp/iqraa-pg.path /var/tmp/iqraa-api.log
```

- [ ] **Step 5: STATUS.md**

Insert a new section directly above the first existing `## … 2026-10-10` heading (newest first; at the time of writing it is `## Greek letters and degrees cut an equation in two, 2026-10-10`):

```markdown
## Messages can be reacted to with an emoji, 2026-10-10

Person-to-person chat (teacher ↔ parent / student, class and custom groups — not
the AI assistant) now takes one fixed-set reaction per person per message:
👍 ❤️ 😂 😮 👏 🙏. Long-press a message for the sheet; chips sit under the bubble.

- **Allowed where posting is not.** A student in an announcement-only group
  (`studentPostingEnabled = false`) cannot send, and can react. That is the
  point of the feature and is deliberate: `reactionAccess` ignores the flag and a
  test pins it. Do not "make it match the send route".
- **Who sees what.** Everyone sees counts and their own mark. Only teacher-role
  viewers get `userIds` (the sheet lists names). A non-teacher never sees a
  reaction from someone they blocked, nor can they react to a blocked sender.
- **Reactions are silent.** No push, no unread change, no inbox reorder
  (`updated_at` / `last_read_at` untouched).
- **The emoji list lives in two places** —
  `artifacts/api-server/src/lib/messageReactions.ts` and
  `artifacts/mobile/services/messageReactions.ts`. Keep the one-line
  declaration identical; `reactionEmojiParity.test.ts` reads both as text.
  `❤️` is two code points, and a bare U+2764 is refused on purpose.
- **Poll limit.** The thread polls every 10 s and fetches only the newest page,
  so a reaction on an older scrolled-back message appears on reopening. A poll
  that started before your own tap lands can flash the old chips until the next one.
- **Long-press changed.** It used to open the report picker straight away; it now
  opens the sheet first (report is the row under the emoji, picker unchanged).
- Migration `0003` (additive). No native module, so `app.json` `version` is unchanged.
- **Verified against a real Postgres** with minted tokens: [paste the observed
  results of Task 7 Step 2 here, one line each]. UI in a browser: [done / not
  exercised — say which].
```

Replace the bracketed placeholders with what you actually observed before committing; do not leave brackets in.

- [ ] **Step 6: Final gates**

```bash
cd /home/user/Iqraa
pnpm run typecheck
(cd artifacts/mobile && pnpm test 2>&1 | tail -6)
(cd artifacts/api-server && pnpm build && pnpm test 2>&1 | tail -6)
git status -sb
```
Expected: typecheck clean; both suites green with the mount-order suite **running**, not skipped; working tree contains only `STATUS.md`.

- [ ] **Step 7: Commit, push, update the PR**

```bash
git add STATUS.md
git commit -F - <<'EOF'
Status: message reactions

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019vPETG2XEpBi5PM2oYMWE3
EOF
git push -u origin ccr-7b9e4e5e-ujzx2x
```

Then update PR #986: retitle to `Message reactions: emoji on person-to-person chat`, replace the "Design spec only — no code" line, and put the Task 7 Step 2 observations and the Step 3 UI statement in the body. Keep the body free of any model identifier, end it with `🤖 Generated with [Claude Code](https://claude.com/claude-code)` and the session link, and leave it a **draft** until the user says otherwise. The PR is already subscribed; do not subscribe again.

---

## Self-Review (done against the spec)

- **Spec §1 Data** → Task 2. **§2 API** (allow-list/summary → Task 1; routes, access, limiter, upsert, idempotent delete, list integration, `reactions: []` default → Task 3). **§3 App** (types/service → 5; pure logic + poll merge → 4; thread screen → 6; bubble → 5; strings → 5). **§4 Safety** → pinned by Task 1 tests (blocked, teacher-only `userIds`, announcement-group `ok`) and exercised in Task 7 Steps 2.1, 2.5, 2.9. **§5 Testing** → Tasks 1, 3 (mount order), 4 (incl. parity), SQL behaviours in Task 7. **§6 Rollout** → no `version` bump (constraint), additive migration (Task 2 Step 3), STATUS.md and header rule 4 (Tasks 3, 7).
- **Deviation from the spec, on purpose:** the spec's prose says the poll runs every 5 s; the code is 10 s (`usePollingRefresh(refresh, 10000)`). Behaviour unchanged, wait longer; recorded under Global Constraints and in the STATUS entry.
- **Placeholder scan:** the only bracketed text is the STATUS entry's evidence slot, with an explicit instruction to replace it before committing. No "TBD / add error handling / similar to Task N".
- **Type consistency:** `ReactionSummary` (API) ↔ `ChatReaction` (app) have the same four fields; `toggleReaction(current, emoji, viewerId?)`, `myReaction`, `sameReactions`, `setReaction`/`clearReaction`, `REACTION_EMOJI`, `reactionAccess`, `summarizeReactions`, `isAllowedReaction` are used with the same names and signatures wherever they appear; the i18n keys in Task 6 are exactly the ones Task 5 defines.
- **Known unverifiable-here item:** iOS's two-Modals-in-one-tick behaviour (hence the 250 ms delay before opening the report picker) cannot be checked in this environment. Say so in the PR rather than asserting it.
