# Message reactions (تفاعلات الرسائل) — design

Date: 2026-10-10 · Status: design approved in conversation, awaiting spec review

## Why

Person-to-person messaging (teacher ↔ parent / student, class groups, custom
groups) has no way to acknowledge a message without sending one. In a class
group that is a real gap, not a nicety: groups are announcement-only by default
(`chat_threads.student_posting_enabled = false`), so a student who has read
«الاختبار الأحد» can do nothing, and a teacher cannot tell understood from
unseen. A fixed-set emoji reaction is a one-tap acknowledgement that adds no
free text for a minor to write and nothing for anyone to moderate.

**Scope: person-to-person messaging only** (`/messaging`, `chat_*` tables). The
AI assistant chat (`/chat`, `conversations`/`messages`) is untouched — a reaction
on an AI reply has no recipient. The two are easy to confuse; see the header of
`lib/db/src/schema/messaging.ts`.

## Decisions taken

| Question | Decision |
| --- | --- |
| Which chat | Person-to-person messaging, not the AI assistant chat |
| Reactions where posting is off | Always allowed. A reaction is an acknowledgement, not a post; `studentPostingEnabled` gates `POST …/messages` only |
| Reactions per person per message | One. Same emoji again removes it; a different emoji replaces it |
| Emoji | Fixed set of six: 👍 ❤️ 😂 😮 👏 🙏. The server rejects anything else |
| Architecture | New table `chat_message_reactions`, unique on `(message_id, user_id)` |
| Who sees who reacted | Everyone sees counts and their own reaction; teacher-role callers also see which accounts |
| Notifications | None. Reactions send no push and do not touch unread counts or inbox order |
| Reacting to own messages | Allowed |

Rejected: a JSON column on `chat_messages` (two simultaneous reactors overwrite
each other, no per-user integrity); several emoji per person (needs a different
unique key and a busier bubble for no stated need).

## 1. Data

New table in `lib/db/src/schema/messaging.ts`, exported through the existing
`export * from "./messaging"`:

```ts
export const chatMessageReactions = pgTable(
  "chat_message_reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id").notNull().references(() => chatMessages.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
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

- `emoji` is `text`, not a Postgres enum: the set may change, and an enum
  change is a migration. The allow-list is enforced in the route (§2).
- Migration `0003`, produced by `pnpm --filter @workspace/db run generate` and
  committed under `lib/db/migrations/`. Additive (new table and indexes only), so
  no `destructive-migration: ok` in the PR body. CI's "schema edit with no
  migration" check is satisfied by committing it.
- Cascade on both FKs: deleting a message or an account removes its reactions.
- A message archived by moderation (`chat_messages.archived_at`) keeps its rows;
  they are simply never returned, because the message is not.

## 2. API

All routes live in `artifacts/api-server/src/routes/messaging.ts`, under the
existing `router.use("/messaging", authMiddleware)`. No new router and no
unscoped middleware, so `mountOrder.test.ts` is unaffected.

### Allow-list and summary — a pure module

`artifacts/api-server/src/lib/messageReactions.ts`, no `db` or OpenAI imports so
`node --test` can load it:

```ts
export const REACTION_EMOJI = ["👍", "❤️", "😂", "😮", "👏", "🙏"] as const;
export function isAllowedReaction(v: unknown): v is (typeof REACTION_EMOJI)[number];

export interface ReactionRow { messageId: string; userId: string; emoji: string }
export interface ReactionSummary { emoji: string; count: number; mine: boolean; userIds?: string[] }

export function summarizeReactions(
  rows: ReactionRow[],
  viewerId: string,
  opts: { viewerIsTeacher: boolean; hiddenUserIds: ReadonlySet<string> },
): Map<string, ReactionSummary[]>;   // messageId → summaries
```

`summarizeReactions` rules:

- Drops rows whose `userId` is in `hiddenUserIds` (the viewer's blocks —
  see below).
- Groups by `(messageId, emoji)`; `count` is the number of remaining rows.
- `mine` is true when the viewer's own row is in that group.
- `userIds` is present only when `viewerIsTeacher`.
- Summaries within a message are ordered by `REACTION_EMOJI` order, then by
  nothing else — stable, so a poll never reshuffles chips.
- A message with no reactions has no entry; the route emits `[]`.

### Set, replace, remove

```
PUT    /messaging/threads/:id/messages/:messageId/reaction   { emoji }
DELETE /messaging/threads/:id/messages/:messageId/reaction
```

Both do the lookups (participant, thread, message, and — for non-teachers — the
viewer's blocks) and hand the results to the pure `reactionAccess` (§5), which
returns `ok` or `not_found`; the route maps `not_found` to a 404 and never says
which condition failed. The conditions, in order:

1. `participantOf(threadId, user.id)` else 404 `not_found` (same as every other
   thread route — a non-member learns nothing about the thread).
2. The message must belong to `:id` and have `archived_at IS NULL`, else 404
   `not_found`. `:messageId` is validated against the existing `UUID` regex
   first (400 `invalid_input`) — a non-uuid reaches Postgres as a cast error and
   500s, as with `blockedUserId`.
3. A non-teacher viewer who has blocked the message's sender gets 404 — they
   cannot see that message in `GET`, so they cannot react to it. Teachers never
   filter, per the file header.
4. Are **not** gated by `studentPostingEnabled`. The route carries a comment
   saying why, and the file header gains rule 4 stating it, so a later reader
   does not "fix" it to match the send route.
5. Share a rate limiter: `createRateLimiter({ windowMs: 60_000, max: 60, name:
   "message-react", key: user id })`. Higher than sends (30/min) because a tap is
   cheap and a person scrolling an announcement thread may react to several
   messages; low enough to stop a script.

`PUT` additionally validates `isAllowedReaction(body.emoji)`, else 400
`invalid_reaction`. It then upserts:

```sql
INSERT … ON CONFLICT (message_id, user_id) DO UPDATE SET emoji = EXCLUDED.emoji, updated_at = now()
```

— race-safe, idempotent (same emoji twice = no change), and a replace is a single
statement. `DELETE` of a non-existent reaction is also a 200 (idempotent), so a
retry after a lost response is harmless.

Both respond `200 { reactions: ReactionSummary[] }` — that message's fresh
summary for the caller, built by `summarizeReactions` — so the client can
reconcile its optimistic state with the server's.

Reactions deliberately do **not** touch `chat_threads.updated_at`,
`chat_participants.last_read_at`, `chat_message_reads`, or call
`notifyThreadParticipants`. Inbox order, unread counts, and "seen" are unchanged
by a reaction.

### Listing

`GET /messaging/threads/:id/messages` gains one query after the page of messages
is loaded:

```ts
const rows = await db.select({ messageId, userId, emoji }).from(chatMessageReactions)
  .where(inArray(chatMessageReactions.messageId, messages.map(m => m.id)));
```

(skipped when the page is empty), then `summarizeReactions(rows, user.id,
{ viewerIsTeacher: isTeacherRole(user.role), hiddenUserIds: blocked })` where
`blocked` is the set the handler already computed for the sender filter (empty
for teachers). Each returned message carries `reactions: ReactionSummary[]`.

`POST …/messages` (the send response) and the inbox's `latest` message also go
through `toClientMessage`; both return `reactions: []` for a message that has
none yet, so the client type is `reactions: ReactionSummary[]` with no optional
branch for these paths. `reactions` on older API builds is absent — the client
treats absent as `[]`.

## 3. App

### Types and service — `artifacts/mobile/services/messaging.ts`

- `ChatMessage` gains `reactions?: ChatReaction[]`
  (`{ emoji; count; mine; userIds?: string[] }`).
- `setReaction(threadId, messageId, emoji)` → `PUT`; `clearReaction(threadId,
  messageId)` → `DELETE`; both return the server's `reactions` array and throw
  `MessagingError` like the rest of the file.

### Pure logic — `artifacts/mobile/services/messageReactions.ts` (new)

Kept out of `messaging.ts` for the reason `messageMerge.ts` documents:
`messaging.ts` imports `expo-image-picker`, which `node --test` cannot load. No
`react-native` or `expo-*` imports, and a `.ts` extension on any relative import
(extensionless relative imports only work through esbuild).

- `REACTION_EMOJI` — the same six, mirrored from the API. **This list lives in
  two places** (see Risks); a comment on each points to the other.
- `toggleReaction(current: ChatReaction[], emoji: string): ChatReaction[]` — the
  optimistic update. Tapping your current emoji removes it; tapping another
  moves your mark to it (decrement old, increment new, drop a chip that reaches
  zero); tapping with no current reaction adds it. Keeps `REACTION_EMOJI` order.
  Never mutates `current`.
- `myReaction(reactions): string | null`.

### Poll merge — `artifacts/mobile/services/messageMerge.ts`

`mergeNewMessages` today adopts only new messages and `seen`. It gains a third
rule: **a message already held takes the poll's `reactions` when they differ**
(compared by emoji, count and `mine`, not by reference), because the poll is the
only way another person's reaction reaches a screen that is already open. Rules
that must survive:

- Nothing new, no new `seen`, no changed reactions → return the original array
  reference (a quiet poll still costs no re-render).
- Generic constraint widens to `{ id; seen?; reactions? }`; still no imports.
- Known limit: the poll fetches only the newest page, so reactions on older,
  scrolled-back messages refresh on reopening the thread. Accepted.
- An in-flight optimistic toggle must not be undone by a poll that was issued
  before the `PUT` landed. The screen holds a per-message `pendingReaction` set;
  `mergeNewMessages` is not told about it — instead the screen filters the polled
  page, dropping `reactions` for ids in that set before merging.

### Thread screen — `artifacts/mobile/app/messaging/[threadId].tsx`

- **Long-press** (`delayLongPress={400}`, as today) now opens a *message sheet*
  for **every** message, replacing the direct jump to the report modal:
  - a row of the six emoji, the viewer's current one highlighted;
  - on someone else's message, «إبلاغ» beneath it, opening the **existing**
    report modal unchanged (`setReportTarget`), so the report flow stays one tap
    away and its `chat_reports` behaviour is untouched;
  - teacher-role viewers see a «تفاعلات» list under the row when the message has
    reactions: each emoji with the names of its reactors, resolved from the
    existing `participantsById` (an id not in the map is shown as «مستخدم»).
- The sheet is a `Modal` with no text input, so it needs no `KeyboardSafeView`
  (CLAUDE.md: only Modals that hold a text input do).
- **Chips** render under the bubble, on the bubble's own edge (trailing for own
  messages, leading beside the avatar for others'), flipping with RTL. Each shows
  `emoji count`; the viewer's own is tinted `colors.primary`. Tapping a chip
  calls the same toggle as the sheet.
- **Optimistic update**: apply `toggleReaction`, fire `setReaction` /
  `clearReaction`, reconcile with the returned `reactions` on success, restore the
  prior array and show the existing screen error text on failure.
- Haptics: `Haptics.selectionAsync()` on opening the sheet (already there) and on
  choosing an emoji.
- Accessibility: each chip has `accessibilityRole="button"`, a label such as
  «👍 ٣ — إزالة تفاعلك», and the sheet's emoji buttons are labelled.

### Bubble — `artifacts/mobile/components/ui/MessageBubble.tsx`

Gains `reactions?: ChatReaction[]` and `onReactionPress?: (emoji: string) =>
void`, and renders the chip row beneath the bubble. The component stays
presentation-only; the toggle logic stays in the screen and the pure module.

### Strings — `artifacts/mobile/services/i18n.ts`

Arabic and English for: sheet title, «إبلاغ» (reuse the existing key if there is
one), «تفاعلات», chip accessibility labels, «مستخدم», and the failure message.
Arabic is the product language; digits in chip counts follow the existing
display-time conversion used elsewhere in the thread screen.

## 4. Safety and privacy

- **No free text.** Six fixed emoji, validated server-side. Nothing a minor can
  type reaches another minor through this feature.
- **Announcement groups stay one-way for words.** Students can acknowledge, not
  post. `studentPostingEnabled` still governs `POST …/messages` and is not
  weakened. Minor-to-minor *visible* traffic through reactions is limited to
  anonymous counts — non-teachers see counts, never who.
- **Teacher oversight is unchanged and slightly better.** The owning teacher is
  a permanent participant, is never blocked-filtered, and now sees which accounts
  reacted. Only `isTeacherRole` callers get `userIds`.
- **Blocks apply.** A non-teacher does not see reactions from accounts they have
  blocked, and cannot react to a blocked sender's messages. A reaction from a
  blocked user still counts for everyone else.
- **Moderation.** An archived message hides its reactions with it. There is no
  report path for a reaction itself — a fixed emoji set has no content to
  report; abuse of the feature is the rate limit's and the block's job.
- **Account deletion** removes the user's reactions (FK cascade).

## 5. Testing (TDD)

API — `artifacts/api-server/src/lib/__tests__/messageReactions.test.ts`:

- `isAllowedReaction`: each of the six passes; `""`, `"👎"`, `"😀"`, a number,
  `null`, a string with a trailing variation selector or ZWJ sequence, and a
  long string all fail. (`❤️` is U+2764 U+FE0F — the test pins the exact code
  points so a client sending bare U+2764 is rejected loudly.)
- `summarizeReactions`: counts by emoji; `mine` only for the viewer; `userIds`
  present for teachers and absent otherwise; `hiddenUserIds` removed from count
  and from `userIds`; chips ordered by `REACTION_EMOJI`; messages without rows
  absent; viewer's own row hidden-listed does not set `mine`.

API — the route's decisions. The repo has no database-backed route tests (the
only route test, `mountOrder.test.ts`, boots the built bundle with no database),
so the decisions are factored into a pure function in `messageReactions.ts` and
tested there:

```ts
export function reactionAccess(i: {
  isParticipant: boolean;
  messageInThread: boolean;
  messageArchived: boolean;
  viewerIsTeacher: boolean;
  viewerBlocksSender: boolean;
  threadType: "direct" | "class_group" | "custom_group";
  studentPostingEnabled: boolean;
}): "ok" | "not_found";
```

The route calls it between its three lookups and the write. Cases:
non-participant → `not_found`; message in another thread → `not_found`;
archived → `not_found`; blocked sender as non-teacher → `not_found`; blocked
sender as teacher → `ok`; a student in a `class_group` with
`studentPostingEnabled = false` → **`ok`** (the decision under test, pinned so a
future "make it match the send route" edit fails a test).

API — mount order: one added case in `mountOrder.test.ts` asserting that an
unauthenticated `PUT /api/messaging/threads/<uuid>/messages/<uuid>/reaction` is
401, like the other `/messaging` routes.

The SQL behaviour that a pure test cannot see — upsert replaces the single row,
same emoji twice is idempotent, `DELETE` twice is 200 both times, neither touches
`chat_threads.updated_at` / `chat_participants.last_read_at`, the 60/min limiter
— is verified by the run against a real Postgres in §6, with the observed
outputs recorded in the PR.

Mobile — `artifacts/mobile/services/__tests__/messageReactions.test.ts` and
an addition to the existing merge tests (inside `services/__tests__/`, the only
glob the mobile runner scans):

- `toggleReaction`: add, remove own, move to another emoji, chip dropped at zero,
  count increments for an emoji others already used, order preserved, input not
  mutated.
- `mergeNewMessages`: held message adopts changed reactions; unchanged reactions
  return the same array reference; new message and changed reactions together;
  `seen` behaviour unchanged (the existing tests must pass untouched).
- A parity test that `REACTION_EMOJI` equals the API's list **by reading the API
  file as text** (no cross-package import) and comparing the literals, so drift
  fails in CI rather than in a teacher's hands.

Gates before the PR: `pnpm run typecheck`; `cd artifacts/mobile && pnpm test`;
`cd artifacts/api-server && pnpm build && pnpm test`; the CI migration checks
(schema edit has a migration; migrations apply to an empty Postgres).

## 6. Rollout and verification

- Additive migration deploys *before* the new API revision takes traffic
  (`deploy.yml`), so the table exists when the routes do. An older app build
  against the new API sees an extra `reactions` field it ignores; a newer app
  against an API without it reads absent as `[]` and its `PUT` 404s, which the
  optimistic rollback handles.
- `reactions` is not an `EXPO_PUBLIC_*` setting and adds no native module, so
  `app.json`'s `version` (the OTA compatibility key) is **not** bumped.
- Verify against the running system, not the tests (CLAUDE.md): run the API
  against a local Postgres with the migrations applied, then with `curl` (or the
  web build) as a student in a class group with posting off: react, replace, react
  again, delete, delete again, and read back the thread's `reactions`; as the
  teacher, confirm the count and the reactor's id/name appear on the next poll
  without reopening the thread; query `chat_threads.updated_at` and
  `chat_participants.last_read_at` before and after to confirm they did not move.
  The plan lists the exact steps; the PR records what was observed.
- `STATUS.md` gets an entry in the same PR, and the `lib/db/src/schema/messaging.ts`
  / `routes/messaging.ts` headers get the rule-4 note.

## Out of scope

The AI assistant chat; a full emoji keyboard; several reactions per person;
push or in-app notification for a reaction; reaction history or "who reacted"
for non-teachers; reactions on attachments' own previews (they ride on the
message); an admin view of reaction counts.

## Risks

- **The emoji list lives in two places** (`api-server/src/lib/messageReactions.ts`
  and `mobile/services/messageReactions.ts`). Mitigated by the server's 400, by a
  comment on each side, and by the text-parity test above. If a third place is
  ever needed (web admin, a shared package), move the list to a `lib/` package.
- **`❤️` is two code points** and some keyboards or JS runtimes emit the bare
  heart. The set is only ever sent from the app's own constants, never typed, and
  the test pins the exact sequence.
- **Poll staleness on older pages** (above) — accepted.
- **Long-press changes meaning.** Teachers used to long-press a student's
  message to report it directly; it now opens a sheet first. One extra tap on a
  safety path is a real cost, which is why «إبلاغ» is the first row under the
  emoji and the report modal itself is unchanged.
