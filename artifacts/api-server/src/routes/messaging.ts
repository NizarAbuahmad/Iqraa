/**
 * Person-to-person chat — direct teacher↔parent/student threads, plus
 * auto-managed class-group threads. Custom (teacher-picked) groups and
 * attachments still arrive later — see the phased rollout in the chat plan.
 * Not the AI teaching-assistant chat (that's routes/chat.ts, mounted at
 * /chat) — this is deliberately /messaging, its own namespace, so the two
 * are never ambiguous in a URL or a grep.
 *
 * Two rules carry the whole safety design here:
 *
 * 1. A direct thread may only ever have one teacher-role participant and one
 *    non-teacher (parent or student) participant — enforced in
 *    POST /messaging/threads. There is no path that creates a direct thread
 *    any other shape, which is what rules out unsupervised parent↔student or
 *    student↔student contact entirely.
 * 2. A class-group thread's membership is *derived*, not editable: it is
 *    exactly the class's teacher plus every student self-linked to a member
 *    of that class (never parents — see syncClassGroupThread). The owning
 *    teacher is included unconditionally and is the one row this sync will
 *    never remove, so a teacher who is a member of a group always stays able
 *    to see every message a minor sends in it.
 * 3. A group is an announcement channel by default: only teachers may post,
 *    until the group's owning teacher flips studentPostingEnabled. So
 *    minor-to-minor traffic does not exist anywhere unless a specific teacher
 *    deliberately turned it on for one specific group — which is what makes
 *    the consent question a per-group decision a teacher owns, rather than a
 *    property of the whole product.
 *
 * Block and report sit on top of both: a block never removes anyone from a
 * shared thread or hides anything from the owning teacher, it only filters
 * the blocker's own view (see blockedSenderIds) and stops a new direct
 * thread from forming between the two. A report is an accountability log the
 * owning teacher can act on, not a moderation queue — the teacher already
 * sees the content, being a permanent participant.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import {
  chatThreads,
  chatParticipants,
  chatMessages,
  chatBlocks,
  chatReports,
  rosterLinks,
  students,
  classGroups,
  classMemberships,
  users,
  devicePushTokens,
  type DevicePushPlatform,
} from "@workspace/db";
import { and, asc, count, desc, eq, inArray, isNull, lt, ne, or } from "drizzle-orm";
import {
  authMiddleware,
  TEACHER_ROLES,
  type AuthenticatedRequest,
} from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";
import { isSchemaMissing } from "../lib/schemaMissing.js";
import { sendExpoPush } from "../lib/pushNotifications.js";
import { isR2Configured, newChatMediaKey, presignedGetUrl, putObject } from "../lib/r2.js";
import { syncClassGroupThread } from "../lib/classThread.js";
import { EXTENSION_BY_MIME, MAX_DATA_URL_LENGTH, kindForMime, parseDataUrl } from "../lib/lessonMediaUpload.js";

const router = Router();

// Path-scoped — see the note in roster.ts. Every /messaging/* route requires
// sign-in, but (unlike roster/evaluations/workspace/generate) NOT a teacher
// role: this is the one surface parents and students are meant to reach.
router.use("/messaging", authMiddleware);

const DEFAULT_MESSAGE_LIMIT = 30;
const MAX_MESSAGE_LIMIT = 100;
const MAX_BODY_LENGTH = 4000;

function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Single exit for every messaging failure: 503 + a code when the schema is absent. Mirrors failRoster. */
function failMessaging(
  res: Parameters<Parameters<typeof router.get>[1]>[1],
  err: unknown,
  action: string,
  message: string,
): void {
  if (isSchemaMissing(err)) {
    logger.error(
      { err },
      `${action} failed — messaging tables are missing from this database. ` +
        "Run `pnpm --filter @workspace/db run push` against DATABASE_URL.",
    );
    res.status(503).json({
      code: "messaging_storage_unavailable",
      error: "Messaging storage is not set up on this server yet.",
    });
    return;
  }
  logger.error({ err }, `${action} failed`);
  res.status(500).json({ error: message });
}

function isTeacherRole(role: string): boolean {
  return TEACHER_ROLES.includes(role);
}

/** True if `otherUserId` is linked (as self or guardian) to a student this teacher owns. */
async function isConnected(teacherId: string, otherUserId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: rosterLinks.id })
    .from(rosterLinks)
    .innerJoin(students, eq(students.id, rosterLinks.studentId))
    .where(and(eq(students.teacherId, teacherId), eq(rosterLinks.userId, otherUserId)))
    .limit(1);
  return !!row;
}

/** A participant's own row in a thread, or null if they aren't in it. */
async function participantOf(threadId: string, userId: string) {
  const [row] = await db
    .select()
    .from(chatParticipants)
    .where(and(eq(chatParticipants.threadId, threadId), eq(chatParticipants.userId, userId)))
    .limit(1);
  return row ?? null;
}

/**
 * The teacher who owns a group thread — its creator for a custom group, the
 * class's own teacher for a class group (whose createdBy is null by design).
 * Null for a direct thread, which has no owner: both sides are equal there.
 */
async function groupOwnerId(thread: typeof chatThreads.$inferSelect): Promise<string | null> {
  if (thread.type === "custom_group") return thread.createdBy;
  if (thread.type === "class_group" && thread.classGroupId) {
    const [group] = await db
      .select({ teacherId: classGroups.teacherId })
      .from(classGroups)
      .where(eq(classGroups.id, thread.classGroupId))
      .limit(1);
    return group?.teacherId ?? null;
  }
  return null;
}

async function participantsOf(threadId: string) {
  return db
    .select({ userId: users.id, firstName: users.firstName, lastName: users.lastName, role: users.role })
    .from(chatParticipants)
    .innerJoin(users, eq(users.id, chatParticipants.userId))
    .where(eq(chatParticipants.threadId, threadId));
}

/** A message as sent over the wire: the R2 key never leaves the server, only a time-limited signed URL (see lib/r2.ts). */
async function toClientMessage(row: typeof chatMessages.$inferSelect) {
  return {
    ...row,
    attachmentUrl: row.attachmentKey ? await presignedGetUrl(row.attachmentKey) : null,
  };
}

async function toClientMessages(rows: (typeof chatMessages.$inferSelect)[]) {
  return Promise.all(rows.map(toClientMessage));
}

/** Every userId `viewerId` has blocked — teachers never filter (see file header), so callers should skip this for them. */
async function blockedSenderIds(viewerId: string): Promise<Set<string>> {
  const rows = await db
    .select({ blockedUserId: chatBlocks.blockedUserId })
    .from(chatBlocks)
    .where(eq(chatBlocks.blockerUserId, viewerId));
  return new Set(rows.map(r => r.blockedUserId));
}

const PUSH_BODY_PREVIEW_LENGTH = 120;

/**
 * Fire-and-forget: routes/messaging.ts's send-message handler calls this
 * after responding, never before — a push failure must never turn into a
 * failed message send. Skips anyone who has blocked the sender, same as the
 * in-app view does (see blockedSenderIds).
 */
async function notifyThreadParticipants(threadId: string, senderId: string, body: string): Promise<void> {
  const participants = await participantsOf(threadId);
  const recipientIds = participants.map(p => p.userId).filter(id => id !== senderId);
  if (recipientIds.length === 0) return;

  const blockedByRows = await db
    .select({ blockerUserId: chatBlocks.blockerUserId })
    .from(chatBlocks)
    .where(and(inArray(chatBlocks.blockerUserId, recipientIds), eq(chatBlocks.blockedUserId, senderId)));
  const blockedBy = new Set(blockedByRows.map(r => r.blockerUserId));
  const notifiable = recipientIds.filter(id => !blockedBy.has(id));
  if (notifiable.length === 0) return;

  const tokenRows = await db
    .select({ expoPushToken: devicePushTokens.expoPushToken })
    .from(devicePushTokens)
    .where(inArray(devicePushTokens.userId, notifiable));
  if (tokenRows.length === 0) return;

  const [sender] = await db
    .select({ firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.id, senderId))
    .limit(1);
  const senderName = sender ? `${sender.firstName} ${sender.lastName}` : "Iqraa";
  const preview = body.length > PUSH_BODY_PREVIEW_LENGTH ? `${body.slice(0, PUSH_BODY_PREVIEW_LENGTH - 1)}…` : body;

  await sendExpoPush(
    tokenRows.map(t => ({ to: t.expoPushToken, title: senderName, body: preview, data: { threadId } })),
  );
}

// ─── Contacts ────────────────────────────────────────────────────────────────

/**
 * Who this user is allowed to start a direct thread with — there is no open
 * directory, only people connected through a claimed roster link. A teacher
 * sees each of their students' guardians; a parent or student sees each
 * linked student's teacher.
 */
router.get("/messaging/contacts", async (req: AuthenticatedRequest, res) => {
  try {
    if (isTeacherRole(req.user!.role)) {
      const rows = await db
        .select({
          studentId: students.id,
          studentName: students.displayName,
          userId: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
        })
        .from(students)
        .innerJoin(rosterLinks, eq(rosterLinks.studentId, students.id))
        .innerJoin(users, eq(users.id, rosterLinks.userId))
        .where(and(eq(students.teacherId, req.user!.id), isNull(students.archivedAt)))
        .orderBy(asc(students.displayName));

      // Which classes each student sits in, so the picker can offer "everyone
      // in 10-أ" rather than thirty individual ticks. A separate query and not
      // a join on `rows` above: a student belongs to many classes by design
      // (see the comment on classMemberships), so joining would multiply every
      // contact row by that student's class count and the grouping below would
      // have to undo it.
      const classRows = await db
        .select({
          studentId: classMemberships.studentId,
          id: classGroups.id,
          name: classGroups.name,
          nameAr: classGroups.nameAr,
        })
        .from(classMemberships)
        .innerJoin(classGroups, eq(classGroups.id, classMemberships.classGroupId))
        .innerJoin(students, eq(students.id, classMemberships.studentId))
        .where(and(eq(students.teacherId, req.user!.id), isNull(classGroups.archivedAt)))
        .orderBy(asc(classGroups.name));

      const classesByStudent = new Map<string, { id: string; name: string; nameAr: string }[]>();
      for (const row of classRows) {
        const list = classesByStudent.get(row.studentId);
        const entry = { id: row.id, name: row.name, nameAr: row.nameAr };
        if (list) list.push(entry);
        else classesByStudent.set(row.studentId, [entry]);
      }

      const byStudent = new Map<
        string,
        {
          studentId: string;
          studentName: string;
          classes: { id: string; name: string; nameAr: string }[];
          contacts: typeof rows;
        }
      >();
      for (const row of rows) {
        const entry = byStudent.get(row.studentId);
        if (entry) entry.contacts.push(row);
        else
          byStudent.set(row.studentId, {
            studentId: row.studentId,
            studentName: row.studentName,
            classes: classesByStudent.get(row.studentId) ?? [],
            contacts: [row],
          });
      }
      res.json({ students: [...byStudent.values()] });
      return;
    }

    const rows = await db
      .select({
        studentId: students.id,
        studentName: students.displayName,
        userId: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
      })
      .from(rosterLinks)
      .innerJoin(students, eq(students.id, rosterLinks.studentId))
      .innerJoin(users, eq(users.id, students.teacherId))
      .where(and(eq(rosterLinks.userId, req.user!.id), isNull(students.archivedAt)));

    res.json({ students: rows });
  } catch (err) {
    failMessaging(res, err, "list contacts", "Failed to load contacts");
  }
});

// ─── Threads ─────────────────────────────────────────────────────────────────

router.get("/messaging/threads", async (req: AuthenticatedRequest, res) => {
  try {
    const mine = await db
      .select({ threadId: chatParticipants.threadId, lastReadAt: chatParticipants.lastReadAt })
      .from(chatParticipants)
      .where(eq(chatParticipants.userId, req.user!.id));

    if (mine.length === 0) {
      res.json({ threads: [] });
      return;
    }

    const threadIds = mine.map(m => m.threadId);
    const lastReadByThread = new Map(mine.map(m => [m.threadId, m.lastReadAt]));

    const threadRows = await db
      .select()
      .from(chatThreads)
      .where(and(inArray(chatThreads.id, threadIds), isNull(chatThreads.archivedAt)));

    const otherParticipants = await db
      .select({
        threadId: chatParticipants.threadId,
        userId: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
      })
      .from(chatParticipants)
      .innerJoin(users, eq(users.id, chatParticipants.userId))
      .where(and(inArray(chatParticipants.threadId, threadIds), ne(chatParticipants.userId, req.user!.id)));
    const otherByThread = new Map(otherParticipants.map(p => [p.threadId, p]));

    // One query for every message across every one of my threads, newest
    // first, then aggregated in JS below. Roster-sized scale (a teacher's own
    // parents, or one family's teachers) — not worth a per-thread round trip
    // or a raw grouped-SQL query for this.
    const allMessages = await db
      .select()
      .from(chatMessages)
      .where(and(inArray(chatMessages.threadId, threadIds), isNull(chatMessages.archivedAt)))
      .orderBy(desc(chatMessages.createdAt));

    // Teachers never filter blocked senders (see file header) — only worth
    // the extra query for a non-teacher viewer.
    const blocked = isTeacherRole(req.user!.role) ? null : await blockedSenderIds(req.user!.id);

    const threads = await Promise.all(threadRows.map(async thread => {
      const lastReadAt = lastReadByThread.get(thread.id) ?? null;
      const messages = allMessages
        .filter(m => m.threadId === thread.id)
        .filter(m => !blocked || !blocked.has(m.senderId));
      const lastMessage = messages[0] ? await toClientMessage(messages[0]) : null;
      const unreadCount = messages.filter(
        m => m.senderId !== req.user!.id && (!lastReadAt || m.createdAt > lastReadAt),
      ).length;

      return {
        id: thread.id,
        type: thread.type,
        title: thread.title,
        titleAr: thread.titleAr,
        createdBy: thread.createdBy,
        otherParticipant: otherByThread.get(thread.id) ?? null,
        lastMessage,
        unreadCount,
        updatedAt: thread.updatedAt,
      };
    }));

    threads.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    res.json({ threads });
  } catch (err) {
    failMessaging(res, err, "list threads", "Failed to load threads");
  }
});

/**
 * Get-or-create a direct thread. The only rule that matters here: exactly one
 * side must be a teacher, and the two must already be connected through a
 * claimed roster link — see the file header.
 */
router.post("/messaging/threads", async (req: AuthenticatedRequest, res) => {
  try {
    const counterpartUserId = trimmed(req.body?.counterpartUserId);
    if (!counterpartUserId) {
      res.status(400).json({ error: "counterpartUserId is required" });
      return;
    }
    if (counterpartUserId === req.user!.id) {
      res.status(400).json({ error: "Cannot start a thread with yourself" });
      return;
    }

    const [counterpart] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, counterpartUserId))
      .limit(1);
    if (!counterpart) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const meIsTeacher = isTeacherRole(req.user!.role);
    const counterpartIsTeacher = isTeacherRole(counterpart.role);
    if (meIsTeacher === counterpartIsTeacher) {
      res.status(403).json({ error: "Direct messages are only between a teacher and a parent or student" });
      return;
    }

    const teacherId = meIsTeacher ? req.user!.id : counterpart.id;
    const otherId = meIsTeacher ? counterpart.id : req.user!.id;
    if (!(await isConnected(teacherId, otherId))) {
      res.status(403).json({ error: "You are not connected to this person" });
      return;
    }

    const [existingBlock] = await db
      .select({ id: chatBlocks.id })
      .from(chatBlocks)
      .where(
        or(
          and(eq(chatBlocks.blockerUserId, req.user!.id), eq(chatBlocks.blockedUserId, counterpartUserId)),
          and(eq(chatBlocks.blockerUserId, counterpartUserId), eq(chatBlocks.blockedUserId, req.user!.id)),
        ),
      )
      .limit(1);
    if (existingBlock) {
      res.status(403).json({ error: "Cannot start a conversation with this person" });
      return;
    }

    const directKey = [req.user!.id, counterpartUserId].sort().join(":");

    let [thread] = await db.select().from(chatThreads).where(eq(chatThreads.directKey, directKey)).limit(1);
    if (!thread) {
      const inserted = await db
        .insert(chatThreads)
        .values({ type: "direct", directKey, createdBy: req.user!.id })
        .onConflictDoNothing()
        .returning();
      thread = inserted[0];
      if (!thread) {
        // Lost a create race to a concurrent request — the row exists now.
        [thread] = await db.select().from(chatThreads).where(eq(chatThreads.directKey, directKey)).limit(1);
      }
    }
    if (!thread) throw new Error("Failed to create thread");

    await db
      .insert(chatParticipants)
      .values([
        { threadId: thread.id, userId: req.user!.id },
        { threadId: thread.id, userId: counterpartUserId },
      ])
      .onConflictDoNothing();

    res.status(201).json({ thread });
  } catch (err) {
    failMessaging(res, err, "create thread", "Failed to create thread");
  }
});

/**
 * Get-or-create the thread for a class. Reachable by the owning teacher, or
 * by a student self-linked to a current member of the class — never by a
 * parent (class-group threads never include parents; see the file header).
 * 404, not 403, on anyone else: whether this class exists isn't theirs to know.
 */
router.get("/messaging/threads/class/:classGroupId", async (req: AuthenticatedRequest, res) => {
  try {
    const classGroupId = req.params["classGroupId"] as string;
    const [group] = await db.select().from(classGroups).where(eq(classGroups.id, classGroupId)).limit(1);
    if (!group) {
      res.status(404).json({ error: "Class not found" });
      return;
    }

    let isMember = group.teacherId === req.user!.id;
    if (!isMember) {
      const [link] = await db
        .select({ id: rosterLinks.id })
        .from(rosterLinks)
        .innerJoin(classMemberships, eq(classMemberships.studentId, rosterLinks.studentId))
        .where(
          and(
            eq(rosterLinks.userId, req.user!.id),
            eq(rosterLinks.relation, "self"),
            eq(classMemberships.classGroupId, classGroupId),
          ),
        )
        .limit(1);
      isMember = !!link;
    }
    if (!isMember) {
      res.status(404).json({ error: "Class not found" });
      return;
    }

    const thread = await syncClassGroupThread(classGroupId, group.teacherId, group.name, group.nameAr);
    const participants = await participantsOf(thread.id);
    res.json({ thread, participants, isOwner: group.teacherId === req.user!.id });
  } catch (err) {
    failMessaging(res, err, "get class thread", "Failed to load class thread");
  }
});

const MAX_CUSTOM_GROUP_MEMBERS = 100;

/**
 * Teacher-only, arbitrary member list — every member must already be
 * connected to this teacher through a claimed roster link (see isConnected),
 * same trust boundary as a direct thread. `createdBy` is this group's owner
 * for every membership-management route below; it is a permanent member and
 * this is the only route that adds them (see removeParticipant's guard).
 */
router.post("/messaging/threads/custom", async (req: AuthenticatedRequest, res) => {
  try {
    if (!isTeacherRole(req.user!.role)) {
      res.status(403).json({ error: "Only a teacher can create a group" });
      return;
    }

    const title = trimmed(req.body?.title);
    const titleAr = trimmed(req.body?.titleAr) || title;
    const memberIds = [...new Set(Array.isArray(req.body?.participantUserIds) ? req.body.participantUserIds : [])]
      .filter((id): id is string => typeof id === "string" && id !== req.user!.id);

    if (!title) {
      res.status(400).json({ error: "title is required" });
      return;
    }
    if (memberIds.length === 0) {
      res.status(400).json({ error: "At least one other member is required" });
      return;
    }
    if (memberIds.length > MAX_CUSTOM_GROUP_MEMBERS) {
      res.status(400).json({ error: `A group can have at most ${MAX_CUSTOM_GROUP_MEMBERS} other members` });
      return;
    }

    const connected = await Promise.all(memberIds.map(id => isConnected(req.user!.id, id)));
    if (connected.some(ok => !ok)) {
      res.status(403).json({ error: "You are not connected to every person in this list" });
      return;
    }

    const [thread] = await db
      .insert(chatThreads)
      .values({ type: "custom_group", title, titleAr, createdBy: req.user!.id })
      .returning();
    if (!thread) throw new Error("Failed to create group");

    await db
      .insert(chatParticipants)
      .values([req.user!.id, ...memberIds].map(userId => ({ threadId: thread.id, userId })));

    res.status(201).json({ thread, participants: await participantsOf(thread.id), isOwner: true });
  } catch (err) {
    failMessaging(res, err, "create group", "Failed to create group");
  }
});

/** Adds members to a custom group — the owning teacher only (see the file header on why class-group membership can't be edited this way). */
router.post("/messaging/threads/:id/participants", async (req: AuthenticatedRequest, res) => {
  try {
    const threadId = req.params["id"] as string;
    const [thread] = await db.select().from(chatThreads).where(eq(chatThreads.id, threadId)).limit(1);
    if (!thread || thread.type !== "custom_group" || thread.createdBy !== req.user!.id) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    const memberIds = [...new Set(Array.isArray(req.body?.participantUserIds) ? req.body.participantUserIds : [])]
      .filter((id): id is string => typeof id === "string" && id !== req.user!.id);
    if (memberIds.length === 0) {
      res.status(400).json({ error: "At least one member id is required" });
      return;
    }

    // The cap belongs on the total, not the batch: it was only ever checked on
    // create, so a group could be grown past MAX_CUSTOM_GROUP_MEMBERS by
    // repeated adds — and each id in an unbounded array costs its own
    // isConnected round trip below. Counted before that loop for exactly that
    // reason. Already-present ids are conflict-ignored on insert rather than
    // subtracted here, so re-adding an existing member can refuse near the
    // ceiling; that is the safe direction to be wrong in.
    const [{ count: currentMembers }] = await db
      .select({ count: count() })
      .from(chatParticipants)
      .where(eq(chatParticipants.threadId, threadId));
    if (currentMembers + memberIds.length > MAX_CUSTOM_GROUP_MEMBERS) {
      res.status(400).json({ error: `A group can hold at most ${MAX_CUSTOM_GROUP_MEMBERS} members` });
      return;
    }

    const connected = await Promise.all(memberIds.map(id => isConnected(req.user!.id, id)));
    if (connected.some(ok => !ok)) {
      res.status(403).json({ error: "You are not connected to every person in this list" });
      return;
    }

    await db
      .insert(chatParticipants)
      .values(memberIds.map(userId => ({ threadId, userId })))
      .onConflictDoNothing();

    res.status(201).json({ participants: await participantsOf(threadId) });
  } catch (err) {
    failMessaging(res, err, "add group members", "Failed to add members");
  }
});

/**
 * Removes one member — the owning teacher can remove anyone else; anyone
 * else can only remove themselves (leaving). The owner can never be removed,
 * by either path — that guarantee is the whole point of a "permanent
 * teacher" group, so it is checked before either of the two paths above it.
 */
router.delete("/messaging/threads/:id/participants/:userId", async (req: AuthenticatedRequest, res) => {
  try {
    const threadId = req.params["id"] as string;
    const targetUserId = req.params["userId"] as string;
    const [thread] = await db.select().from(chatThreads).where(eq(chatThreads.id, threadId)).limit(1);
    if (!thread || thread.type !== "custom_group" || !(await participantOf(threadId, req.user!.id))) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    if (targetUserId === thread.createdBy) {
      res.status(400).json({ error: "The group owner cannot be removed" });
      return;
    }
    if (targetUserId !== req.user!.id && thread.createdBy !== req.user!.id) {
      res.status(403).json({ error: "Only the group owner can remove another member" });
      return;
    }

    await db
      .delete(chatParticipants)
      .where(and(eq(chatParticipants.threadId, threadId), eq(chatParticipants.userId, targetUserId)));

    res.json({ removedUserId: targetUserId });
  } catch (err) {
    failMessaging(res, err, "remove group member", "Failed to remove member");
  }
});

/**
 * Flips who may post in a group — the owning teacher only. The one setting
 * that decides whether minors can message each other here, so it is deliberately
 * not delegable: 404 (not 403) for anyone else, since whether this group exists
 * is not theirs to learn.
 */
router.patch("/messaging/threads/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const threadId = req.params["id"] as string;
    const [thread] = await db.select().from(chatThreads).where(eq(chatThreads.id, threadId)).limit(1);
    if (!thread || thread.type === "direct") {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    const ownerId = await groupOwnerId(thread);
    if (!ownerId || ownerId !== req.user!.id) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    if (typeof req.body?.studentPostingEnabled !== "boolean") {
      res.status(400).json({ error: "studentPostingEnabled must be a boolean" });
      return;
    }

    const [updated] = await db
      .update(chatThreads)
      .set({ studentPostingEnabled: req.body.studentPostingEnabled, updatedAt: new Date() })
      .where(eq(chatThreads.id, threadId))
      .returning();

    res.json({ thread: updated });
  } catch (err) {
    failMessaging(res, err, "update group", "Failed to update group");
  }
});

router.get("/messaging/threads/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const threadId = req.params["id"] as string;
    if (!(await participantOf(threadId, req.user!.id))) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }

    const [thread] = await db.select().from(chatThreads).where(eq(chatThreads.id, threadId)).limit(1);
    if (!thread) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }

    if (thread.type !== "direct") {
      const participants = await participantsOf(threadId);
      const isOwner = (await groupOwnerId(thread)) === req.user!.id;
      res.json({ thread, otherParticipant: null, participants, isOwner });
      return;
    }

    const [other] = await db
      .select({ userId: users.id, firstName: users.firstName, lastName: users.lastName, role: users.role })
      .from(chatParticipants)
      .innerJoin(users, eq(users.id, chatParticipants.userId))
      .where(and(eq(chatParticipants.threadId, threadId), ne(chatParticipants.userId, req.user!.id)))
      .limit(1);

    let isBlocked = false;
    if (other) {
      const [b] = await db
        .select({ id: chatBlocks.id })
        .from(chatBlocks)
        .where(and(eq(chatBlocks.blockerUserId, req.user!.id), eq(chatBlocks.blockedUserId, other.userId)))
        .limit(1);
      isBlocked = !!b;
    }

    res.json({ thread, otherParticipant: other ?? null, isBlocked });
  } catch (err) {
    failMessaging(res, err, "get thread", "Failed to load thread");
  }
});

// ─── Messages ────────────────────────────────────────────────────────────────

/**
 * Cursor-paginated by createdAt, newest page first. Also marks the thread
 * read for the caller — this endpoint IS "mark as read"; there is no
 * separate one, since opening the thread is what reading means.
 */
router.get("/messaging/threads/:id/messages", async (req: AuthenticatedRequest, res) => {
  try {
    const threadId = req.params["id"] as string;
    if (!(await participantOf(threadId, req.user!.id))) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }

    const before = trimmed(req.query["before"]);
    const beforeDate = before ? new Date(before) : null;
    if (before && (!beforeDate || Number.isNaN(beforeDate.getTime()))) {
      res.status(400).json({ error: "before must be a valid ISO date" });
      return;
    }

    const requestedLimit = Number(req.query["limit"]);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, MAX_MESSAGE_LIMIT)
      : DEFAULT_MESSAGE_LIMIT;

    const rows = await db
      .select()
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.threadId, threadId),
          isNull(chatMessages.archivedAt),
          beforeDate ? lt(chatMessages.createdAt, beforeDate) : undefined,
        ),
      )
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);

    // Teachers never filter blocked senders — see the file header on why.
    const messages = isTeacherRole(req.user!.role)
      ? rows
      : await (async () => {
          const blocked = await blockedSenderIds(req.user!.id);
          return blocked.size === 0 ? rows : rows.filter(m => !blocked.has(m.senderId));
        })();

    await db
      .update(chatParticipants)
      .set({ lastReadAt: new Date() })
      .where(and(eq(chatParticipants.threadId, threadId), eq(chatParticipants.userId, req.user!.id)));

    res.json({ messages: await toClientMessages(messages) });
  } catch (err) {
    failMessaging(res, err, "list messages", "Failed to load messages");
  }
});

/**
 * Text and/or one attachment (`attachmentDataUrl`, a `data:` URL — same
 * shape `lessonMedia.ts` uses; there is no multipart path in this server).
 * At least one of the two is required. Attachment upload reuses R2 and the
 * mime allowlist from lib/lessonMediaUpload.ts wholesale — a chat photo has
 * the same size/type constraints a lesson photo does.
 */
router.post("/messaging/threads/:id/messages", async (req: AuthenticatedRequest, res) => {
  try {
    const threadId = req.params["id"] as string;
    if (!(await participantOf(threadId, req.user!.id))) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }

    // A group is an announcement channel unless its owning teacher opened it
    // — see chatThreads.studentPostingEnabled. Enforced here rather than only
    // hiding the composer, because a hidden button is not a rule.
    const [sendThread] = await db.select().from(chatThreads).where(eq(chatThreads.id, threadId)).limit(1);
    if (
      sendThread &&
      sendThread.type !== "direct" &&
      !sendThread.studentPostingEnabled &&
      !isTeacherRole(req.user!.role)
    ) {
      res.status(403).json({ error: "Only the teacher can post in this group", code: "group_read_only" });
      return;
    }

    const body = trimmed(req.body?.body);
    const dataUrl = typeof req.body?.attachmentDataUrl === "string" ? req.body.attachmentDataUrl : "";
    if (!body && !dataUrl) {
      res.status(400).json({ error: "body or an attachment is required" });
      return;
    }
    if (body.length > MAX_BODY_LENGTH) {
      res.status(400).json({ error: `body must be at most ${MAX_BODY_LENGTH} characters` });
      return;
    }

    let attachment: { key: string; kind: "image" | "audio" | "document"; mime: string; sizeBytes: number } | null = null;
    if (dataUrl) {
      if (!isR2Configured()) {
        res.status(503).json({
          code: "lesson_media_unavailable",
          error: "Attachments are not set up on this server yet.",
        });
        return;
      }
      if (dataUrl.length > MAX_DATA_URL_LENGTH) {
        res.status(413).json({ error: "That file is too large.", code: "file_too_large" });
        return;
      }
      const parsed = parseDataUrl(dataUrl);
      if (!parsed) {
        res.status(400).json({ error: "attachmentDataUrl must be a data: URL", code: "bad_data_url" });
        return;
      }
      const extension = EXTENSION_BY_MIME[parsed.mime];
      if (!extension) {
        res.status(400).json({ error: `Unsupported file type: ${parsed.mime}`, code: "unsupported_type" });
        return;
      }
      const key = newChatMediaKey(extension);
      await putObject(key, parsed.buffer, parsed.mime);
      attachment = { key, kind: kindForMime(parsed.mime), mime: parsed.mime, sizeBytes: parsed.buffer.length };
    }

    const [message] = await db
      .insert(chatMessages)
      .values({
        threadId,
        senderId: req.user!.id,
        body,
        attachmentKey: attachment?.key ?? null,
        attachmentKind: attachment?.kind ?? null,
        attachmentMime: attachment?.mime ?? null,
        attachmentSizeBytes: attachment?.sizeBytes ?? null,
      })
      .returning();

    await db.update(chatThreads).set({ updatedAt: new Date() }).where(eq(chatThreads.id, threadId));
    await db
      .update(chatParticipants)
      .set({ lastReadAt: new Date() })
      .where(and(eq(chatParticipants.threadId, threadId), eq(chatParticipants.userId, req.user!.id)));

    res.status(201).json({ message: await toClientMessage(message!) });

    notifyThreadParticipants(threadId, req.user!.id, body || "📎").catch(err =>
      logger.error({ err }, "push notify failed"),
    );
  } catch (err) {
    failMessaging(res, err, "send message", "Failed to send message");
  }
});

// ─── Block & report ─────────────────────────────────────────────────────────

router.post("/messaging/blocks", async (req: AuthenticatedRequest, res) => {
  try {
    const blockedUserId = trimmed(req.body?.blockedUserId);
    if (!blockedUserId) {
      res.status(400).json({ error: "blockedUserId is required" });
      return;
    }
    if (blockedUserId === req.user!.id) {
      res.status(400).json({ error: "Cannot block yourself" });
      return;
    }

    await db
      .insert(chatBlocks)
      .values({ blockerUserId: req.user!.id, blockedUserId })
      .onConflictDoNothing();

    res.status(201).json({ blockedUserId });
  } catch (err) {
    failMessaging(res, err, "block user", "Failed to block user");
  }
});

router.delete("/messaging/blocks/:blockedUserId", async (req: AuthenticatedRequest, res) => {
  try {
    const blockedUserId = req.params["blockedUserId"] as string;
    await db
      .delete(chatBlocks)
      .where(and(eq(chatBlocks.blockerUserId, req.user!.id), eq(chatBlocks.blockedUserId, blockedUserId)));
    res.json({ unblockedUserId: blockedUserId });
  } catch (err) {
    failMessaging(res, err, "unblock user", "Failed to unblock user");
  }
});

/**
 * Logs a concern for the thread's owning teacher to act on — they already
 * see the content (they're a permanent participant), so this adds
 * accountability, not new visibility. See the file header.
 */
router.post("/messaging/reports", async (req: AuthenticatedRequest, res) => {
  try {
    const threadId = trimmed(req.body?.threadId);
    const reportedUserId = trimmed(req.body?.reportedUserId);
    const messageId = trimmed(req.body?.messageId) || null;
    const reason = trimmed(req.body?.reason);

    if (!threadId || !reportedUserId) {
      res.status(400).json({ error: "threadId and reportedUserId are required" });
      return;
    }
    if (!(await participantOf(threadId, req.user!.id))) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }

    const [report] = await db
      .insert(chatReports)
      .values({ reporterUserId: req.user!.id, reportedUserId, threadId, messageId, reason })
      .returning();

    res.status(201).json({ report });
  } catch (err) {
    failMessaging(res, err, "report", "Failed to submit report");
  }
});

// ─── Device push tokens ─────────────────────────────────────────────────────

const PUSH_PLATFORMS: DevicePushPlatform[] = ["ios", "android", "web"];

/**
 * Upsert by token, not by user: the same token re-registering (app restart,
 * re-login) just needs its owner brought up to date, not a duplicate row —
 * see devicePushTokens's "one row per device" note in the schema.
 */
router.post("/messaging/device-tokens", async (req: AuthenticatedRequest, res) => {
  try {
    const expoPushToken = trimmed(req.body?.expoPushToken);
    const platform = trimmed(req.body?.platform) as DevicePushPlatform;
    if (!expoPushToken || !PUSH_PLATFORMS.includes(platform)) {
      res.status(400).json({ error: "expoPushToken and a valid platform are required" });
      return;
    }

    await db
      .insert(devicePushTokens)
      .values({ userId: req.user!.id, expoPushToken, platform })
      .onConflictDoUpdate({
        target: devicePushTokens.expoPushToken,
        set: { userId: req.user!.id, platform, updatedAt: new Date() },
      });

    res.status(201).json({ ok: true });
  } catch (err) {
    failMessaging(res, err, "register device token", "Failed to register device token");
  }
});

router.delete("/messaging/device-tokens/:token", async (req: AuthenticatedRequest, res) => {
  try {
    const token = req.params["token"] as string;
    await db
      .delete(devicePushTokens)
      .where(and(eq(devicePushTokens.userId, req.user!.id), eq(devicePushTokens.expoPushToken, token)));
    res.json({ ok: true });
  } catch (err) {
    failMessaging(res, err, "unregister device token", "Failed to unregister device token");
  }
});

export default router;
