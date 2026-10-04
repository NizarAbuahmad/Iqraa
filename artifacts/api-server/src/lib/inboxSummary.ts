/**
 * The two numbers the inbox shows per thread — its latest message and how
 * many are unread — asked of the database rather than worked out in memory.
 *
 * `GET /messaging/threads` used to load every message of every thread the
 * caller belongs to and pick these out in JavaScript. A class group gains a
 * message per announcement and never loses one, and the app polls this route
 * from two screens, so the cost grew with a class's whole history on every
 * poll. Now: one indexed lookup per thread for the latest message, and one
 * grouped count of the unread ones.
 *
 * "Visible" means what the old in-memory version meant: not archived by
 * moderation, and not from a sender the viewer blocked (the caller passes an
 * empty list for a teacher, who never filters — see routes/messaging.ts).
 */
import { db, chatMessages, chatParticipants } from "@workspace/db";
import { and, eq, gt, inArray, isNull, ne, notInArray, or, sql } from "drizzle-orm";

function visibleIn(threadIds: string[], blockedSenderIds: readonly string[]) {
  return and(
    inArray(chatMessages.threadId, threadIds),
    isNull(chatMessages.archivedAt),
    blockedSenderIds.length ? notInArray(chatMessages.senderId, [...blockedSenderIds]) : undefined,
  );
}

/**
 * The newest visible message in each thread that has one.
 *
 * A `LATERAL … LIMIT 1` per thread rather than `DISTINCT ON`: measured on a
 * local copy of the schema with 480k messages, `DISTINCT ON` sorted every
 * message in the requested threads (260 ms), while this walks
 * `chat_messages_thread_created_idx` backwards and stops at the first visible
 * row (0.2 ms). Ids first, then the rows through the typed builder, so the
 * caller gets the same shape a plain select gives.
 */
export async function latestVisibleMessages(threadIds: string[], blockedSenderIds: readonly string[]) {
  if (threadIds.length === 0) return [];
  const ids = sql.join(threadIds.map(id => sql`${id}`), sql`, `);
  const notBlocked = blockedSenderIds.length
    ? sql`AND cm.sender_id NOT IN (${sql.join(blockedSenderIds.map(id => sql`${id}`), sql`, `)})`
    : sql``;
  const picked = await db.execute<{ id: string }>(sql`
    SELECT m.id
    FROM unnest(ARRAY[${ids}]::uuid[]) AS t(thread_id)
    CROSS JOIN LATERAL (
      SELECT cm.id FROM chat_messages cm
      WHERE cm.thread_id = t.thread_id AND cm.archived_at IS NULL ${notBlocked}
      ORDER BY cm.created_at DESC, cm.id DESC
      LIMIT 1
    ) m
  `);
  const messageIds = picked.rows.map(r => r.id);
  if (messageIds.length === 0) return [];
  return db.select().from(chatMessages).where(inArray(chatMessages.id, messageIds));
}

/**
 * Visible messages from someone else, newer than the viewer last opened the
 * thread (all of them if they never have). Threads with none are absent.
 */
export async function unreadCounts(
  threadIds: string[],
  viewerId: string,
  blockedSenderIds: readonly string[],
): Promise<Map<string, number>> {
  if (threadIds.length === 0) return new Map();
  const rows = await db
    .select({ threadId: chatMessages.threadId, unread: sql<number>`count(*)::int` })
    .from(chatMessages)
    .innerJoin(
      chatParticipants,
      and(eq(chatParticipants.threadId, chatMessages.threadId), eq(chatParticipants.userId, viewerId)),
    )
    .where(
      and(
        visibleIn(threadIds, blockedSenderIds),
        ne(chatMessages.senderId, viewerId),
        or(isNull(chatParticipants.lastReadAt), gt(chatMessages.createdAt, chatParticipants.lastReadAt)),
      ),
    )
    .groupBy(chatMessages.threadId);
  return new Map(rows.map(r => [r.threadId, r.unread]));
}
