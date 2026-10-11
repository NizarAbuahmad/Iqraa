/**
 * In-app messaging — teacher ↔ parent lands first; teacher ↔ student and
 * class/custom groups arrive in later phases (see docs/adding-a-book.md-style
 * plan note: STATUS.md).
 *
 * Deliberately not named `conversations`/`messages` — those tables already
 * exist and back the AI teaching-assistant chat (routes/chat.ts,
 * OpenAI-Conversations-API shaped: role user|assistant, no sender/recipient,
 * no read state). This is a different thing: person-to-person threads with
 * real participants. Reusing those names here would make every future grep
 * for "messages" ambiguous about which chat it means.
 */
import { boolean, pgTable, text, timestamp, uuid, index, integer, unique, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { students, classGroups } from "./students";

export type RosterLinkRelation = "self" | "guardian";

/**
 * Links a real account — a student's own, once they have one, or a parent's
 * — to a roster row a teacher already typed in.
 *
 * A `students` row may have at most one `self` link and any number of
 * `guardian` links. The self rule is checked in the claim route and backed by
 * `roster_links_one_self_idx` below: the route alone was check-then-insert,
 * and two student accounts claiming the same name in the same moment both got
 * through (found 2026-10-02). Deliberately allows one `userId` to appear
 * against many `students` rows: there is no school layer yet (see
 * students.ts), so a child taught by two teachers is two separate `students`
 * rows, and the same parent or student ends up claiming both.
 */
export const rosterLinks = pgTable(
  "roster_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    relation: text("relation").$type<RosterLinkRelation>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [
    unique("roster_links_unique").on(t.studentId, t.userId),
    index("roster_links_user_idx").on(t.userId),
    index("roster_links_student_idx").on(t.studentId),
    // One self-link per student, enforced where a race cannot get past it.
    uniqueIndex("roster_links_one_self_idx").on(t.studentId).where(sql`relation = 'self'`),
  ],
);

export type ChatThreadType = "direct" | "class_group" | "custom_group";

export const chatThreads = pgTable(
  "chat_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").$type<ChatThreadType>().notNull(),
    title: text("title").notNull().default(""),
    titleAr: text("title_ar").notNull().default(""),
    /** Set only for type='class_group'; one thread per class (class_group and custom_group both arrive later — see the phased plan). */
    classGroupId: uuid("class_group_id").references(() => classGroups.id, { onDelete: "cascade" }),
    /**
     * Set only for type='direct': the two participant ids, sorted so the pair
     * always produces the same key regardless of who initiated — that is what
     * makes get-or-create idempotent via `ON CONFLICT (direct_key)` instead of
     * a check-then-insert race.
     */
    directKey: text("direct_key"),
    /** Who created it. Null for an auto-created class_group thread — its owner is classGroups.teacherId instead. */
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "cascade" }),
    /**
     * Whether participants who are not teachers may post here. Default false,
     * deliberately: a group is an announcement channel the teacher broadcasts
     * on unless that teacher opens it. This one flag is what decides whether
     * minors can message each other at all, so it defaults to the safe answer
     * and is only ever flipped by the group's owning teacher (see
     * routes/messaging.ts's PATCH). Meaningless for type='direct', which is
     * always two-way.
     */
    studentPostingEnabled: boolean("student_posting_enabled").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [
    // A nullable-unique column allows any number of NULLs in Postgres, so a
    // direct thread's directKey and a class thread's classGroupId don't
    // collide with every other thread's null value here.
    unique("chat_threads_class_group_unique").on(t.classGroupId),
    unique("chat_threads_direct_key_unique").on(t.directKey),
  ],
);

export const chatParticipants = pgTable(
  "chat_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => chatThreads.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /**
     * Last time this participant opened the thread — this is the whole of the
     * unread-count feature. No per-message read-receipts table: add one only
     * if "seen by" UI is actually requested.
     */
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    /**
     * "Delete for me" / "hide this group": when set, the thread drops out of
     * this participant's inbox until a message newer than this arrives. Per
     * participant on purpose — a class group's membership is re-derived from
     * the roster, so leaving it would be undone, but this survives the sync.
     */
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [
    unique("chat_participants_unique").on(t.threadId, t.userId),
    index("chat_participants_user_idx").on(t.userId),
    index("chat_participants_thread_idx").on(t.threadId),
  ],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => chatThreads.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull().default(""),
    /**
     * All four null together, or all four set — a message has at most one
     * attachment. Same R2-backed shape as lessonMedia (see
     * lib/lessonMediaUpload.ts), under its own `chat-media/` key prefix so the
     * two never collide in the bucket.
     */
    attachmentKey: text("attachment_key"),
    attachmentKind: text("attachment_kind").$type<"image" | "audio" | "document">(),
    attachmentMime: text("attachment_mime"),
    attachmentSizeBytes: integer("attachment_size_bytes"),
    /** Moderation removal — content is kept, just hidden. See routes/messaging.ts. */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [index("chat_messages_thread_created_idx").on(t.threadId, t.createdAt)],
);

/**
 * Blocking hides, it does not remove. A block filters the blocked user's
 * messages out of the blocker's own view of a shared thread (see
 * routes/messaging.ts) and stops a new direct thread forming between the
 * two — it never removes anyone from a class-group thread, and never hides
 * anything from the thread's owning teacher. See the safety design in the
 * chat plan for why: a "block" that could hide activity from a teacher's
 * oversight would defeat the point of that oversight.
 */
export const chatBlocks = pgTable(
  "chat_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blockerUserId: uuid("blocker_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedUserId: uuid("blocked_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [unique("chat_blocks_unique").on(t.blockerUserId, t.blockedUserId)],
);

export type ChatReportStatus = "open" | "reviewed" | "dismissed";

/**
 * An accountability log, not a moderation queue. The teacher who owns the
 * thread already sees every message in it (they're a permanent participant —
 * see routes/messaging.ts), so a report doesn't grant new visibility; it
 * names the message and the reason so the teacher has something to act on.
 */
export const chatReports = pgTable(
  "chat_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterUserId: uuid("reporter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reportedUserId: uuid("reported_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => chatThreads.id, { onDelete: "cascade" }),
    messageId: uuid("message_id").references(() => chatMessages.id, { onDelete: "set null" }),
    reason: text("reason").notNull().default(""),
    status: text("status").$type<ChatReportStatus>().notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [index("chat_reports_thread_idx").on(t.threadId), index("chat_reports_status_idx").on(t.status)],
);

export type DevicePushPlatform = "ios" | "android" | "web";

/**
 * One row per device, not per user — the same account signed in on two
 * phones needs both to get a push, and re-registering the same token just
 * updates whose it is (see routes/messaging.ts's upsert). No delivery-status
 * tracking: Expo's push API is fire-and-forget from this server's side too
 * (see lib/pushNotifications.ts), so a dead token just silently stops
 * mattering rather than being pruned.
 */
export const devicePushTokens = pgTable(
  "device_push_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expoPushToken: text("expo_push_token").notNull().unique(),
    platform: text("platform").$type<DevicePushPlatform>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [index("device_push_tokens_user_idx").on(t.userId)],
);

/**
 * Which messages a participant's screen has actually shown them.
 *
 * `chat_participants.lastReadAt` is thread-level and is the whole of the
 * unread-count feature; it stays. This exists for one question that answer got
 * wrong: whether a parent *letter* was read. One thread carries every child of
 * a parent and every message from a teacher, and the thread screen marks it
 * read on open and on every poll — so opening it for anything marked every
 * pending letter read (see lib/parentContactRead.ts in the API). A row lands
 * here when the reader's list rendered the message (POST
 * /messaging/threads/:id/read); never for the sender's own messages.
 */
export const chatMessageReads = pgTable(
  "chat_message_reads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [
    unique("chat_message_reads_unique").on(t.messageId, t.userId),
    index("chat_message_reads_user_idx").on(t.userId),
  ],
);

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

export type RosterLink = typeof rosterLinks.$inferSelect;
export type ChatMessageRead = typeof chatMessageReads.$inferSelect;
export type ChatMessageReaction = typeof chatMessageReactions.$inferSelect;
export type ChatThread = typeof chatThreads.$inferSelect;
export type ChatParticipant = typeof chatParticipants.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type ChatBlock = typeof chatBlocks.$inferSelect;
export type ChatReport = typeof chatReports.$inferSelect;
export type DevicePushToken = typeof devicePushTokens.$inferSelect;
