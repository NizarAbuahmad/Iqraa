/**
 * Homework a teacher sets for a class — the teacher's side. Students tick it
 * off and families read it through routes of their own.
 *
 * The three things that go wrong here are all about WHOSE row it is:
 *  - a class that is not yours (or is archived, or does not exist) is one 404,
 *    never distinguishable, as in roster.ts;
 *  - an exam must be yours, live, and attached to the homework's OWN class;
 *  - an existing homework is yours only while its class is still live, and a
 *    patch can never move it to another class or teacher — the update below
 *    sets only fields parsePatch produced.
 *
 * Posting tells the class's students and their guardians
 * (lib/familyPushEvents.ts); editing does not. Posting with `shareToChat`, or
 * POST /homework/:id/share later, also leaves a line in the class's group chat
 * (lib/classThread.ts) — not pushed again, the families already were.
 *
 * No `requireRosterConsent`: that gate is about entering a child's information,
 * and homework carries none. Guards are path-scoped (see mountOrder.test.ts):
 * a bare `router.use(mw)` here would guard every router mounted after it.
 */
import { Router, type Response } from "express";
import { db } from "@workspace/db";
import {
  classGroups,
  classMemberships,
  evaluations,
  gameResults,
  homework,
  homeworkCompletions,
  rosterLinks,
  savedMaterials,
  students,
  type ClassGroup,
  type Homework,
  type HomeworkResource,
} from "@workspace/db";
import { and, asc, count, countDistinct, desc, eq, inArray, isNull } from "drizzle-orm";
import { authMiddleware, requireRole, TEACHER_ROLES, type AuthenticatedRequest } from "../middlewares/auth.js";
import { findLiveClass } from "../lib/classOwnership.js";
import { parseClassResourceInput } from "../lib/classResource.js";
import { postToClassThread } from "../lib/classThread.ts";
import { libraryItemSnapshot } from "../lib/librarySnapshot.ts";
import { homeworkChatLine } from "../modules/notifications/familyPushText.ts";
import { announceHomeworkPosted } from "../lib/familyPushEvents.ts";
import { logger } from "../lib/logger";
import { pushWithin } from "../lib/pushWithin.ts";
import { isSchemaMissing } from "../lib/schemaMissing.js";
import { RESOURCES_MAX, dueAtToDueDate, isUuid, parseCreate, parsePatch } from "../modules/homework/rules.ts";
import { GAME_TITLE_MAX, GAMES_TEXT, attachedGames, carryOverGames, gameResourceKey, isGame, type GameKind } from "../modules/homework/game.ts";
import { isMathsLesson } from "../modules/mathPractice/practice.ts";
import { getLessonById } from "@workspace/curriculum";

const router = Router();

router.use("/homework", authMiddleware, requireRole(...TEACHER_ROLES));

const NO_CLASS = { error: "Class not found" } as const;
const NO_HOMEWORK = { error: "Homework not found" } as const;
const BAD_EXAM = { error: "That exam is not attached to this class" } as const;
const LIST_LIMIT = 100;
type Fail = { error: string };

interface TeacherHomework {
  id: string;
  classGroupId: string;
  title: string;
  instructions: string;
  dueDate: string;
  dueAt: string;
  evaluationId: string | null;
  examTitle: string | null;
  resources: HomeworkResource[];
  doneCount: number;
  studentCount: number;
  /** Of studentCount, the rows with a student account — the only ones who can tick it off. */
  trackableCount: number;
}

/** The 400 body: `error` always, `code` when the rule has a machine-readable reason (a client branches on it). */
function parseFailure(f: { error: string; code?: string }): { error: string; code?: string } {
  return f.code ? { error: f.error, code: f.code } : { error: f.error };
}

/** Single exit for every homework failure: 503 + a code when the schema is absent. */
function failHomework(res: Response, err: unknown, action: string): void {
  if (isSchemaMissing(err)) {
    logger.error(
      { err },
      `${action} failed — a homework table is missing from this database. ` +
        "The schema deploys as migrations: check that lib/db/migrations has been applied.",
    );
    res.status(503).json({
      code: "homework_storage_unavailable",
      error: "Homework storage is not set up on this server yet.",
    });
    return;
  }
  logger.error({ err }, `${action} failed`);
  res.status(500).json({ error: `Failed to ${action}` });
}

/**
 * The exam is yours, not archived, and attached to this very class. One answer
 * for all four ways to fail, so the response cannot be used to probe whether
 * someone else's exam id exists.
 */
async function examOk(evaluationId: string, teacherId: string, classId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: evaluations.id })
    .from(evaluations)
    .where(
      and(
        eq(evaluations.id, evaluationId),
        eq(evaluations.teacherId, teacherId),
        isNull(evaluations.archivedAt),
        eq(evaluations.classGroupId, classId),
      ),
    )
    .limit(1);
  return !!row;
}

/**
 * The app sends each attachment as the same body POST /classes/:id/resources
 * takes; each is checked the same way and stored as a snapshot. A repeat of an
 * item already in the list is dropped, not an error. On PATCH an item already
 * attached keeps its stored snapshot unchecked: the edit form resends the whole
 * list, and a staff upload the Library has since deleted must not make every
 * later edit of the homework a 400. A saved material (`kind: 'material'`) is
 * the other kind; see its branch below.
 */
async function resolveResources(raw: unknown[], teacherId: string, attached: HomeworkResource[] = []): Promise<HomeworkResource[] | Fail> {
  const kept = new Map(attached.map(r => [resourceKey(r), r]));
  const out: HomeworkResource[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    // One of the teacher's own materials (ملفاتي): only the id is read from the
    // app; it must be this teacher's row, and title/type come from that row.
    if ((item as { kind?: unknown } | null)?.kind === "material") {
      const materialId = (item as { materialId?: unknown }).materialId;
      if (!isUuid(materialId)) return { error: "materialId must be a saved material id" };
      const key = `material:${materialId.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const old = kept.get(key);
      if (old) {
        out.push(old);
        continue;
      }
      const [m] = await db
        .select({ id: savedMaterials.id, title: savedMaterials.title, type: savedMaterials.type })
        .from(savedMaterials)
        .where(and(eq(savedMaterials.id, materialId), eq(savedMaterials.userId, teacherId)))
        .limit(1);
      // A board reopens only in the teacher's whiteboard tool; nothing renders it read-only.
      if (!m || m.type === "board") return { error: "Saved material not found" };
      out.push({ kind: "material", materialId: m.id, title: m.title, type: m.type });
      continue;
    }
    // A lesson game: a real curriculum lesson and one of the three games. The
    // title is the client's snapshot (trimmed, capped), else the lesson's own.
    if ((item as { kind?: unknown } | null)?.kind === "game") {
      const { lessonId, game, title } = item as { lessonId?: unknown; game?: unknown; title?: unknown };
      if (typeof lessonId !== "string" || lessonId === "") return { error: "lessonId must be a curriculum lesson id" };
      if (!isGame(game)) return { error: `game must be ${GAMES_TEXT}` };
      const key = gameResourceKey(lessonId, game);
      if (seen.has(key)) continue;
      seen.add(key);
      const old = kept.get(key);
      if (old) {
        out.push(old);
        continue;
      }
      const lesson = getLessonById(lessonId);
      if (!lesson) return { error: "lessonId must be a curriculum lesson id" };
      if (game === "exercises" && !isMathsLesson(lessonId)) return { error: "exercises are for a mathematics lesson" };
      const snapshot = typeof title === "string" ? title.trim().slice(0, GAME_TITLE_MAX) : "";
      out.push({ kind: "game", lessonId, game, title: snapshot || lesson.titleAr });
      continue;
    }
    const input = parseClassResourceInput(item);
    if ("error" in input) return { error: input.error };
    const key = `${input.source}:${input.nativeId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const old = kept.get(key);
    if (old) {
      out.push(old);
      continue;
    }
    const snap = await libraryItemSnapshot(input);
    if (!snap) return { error: "Library item not found" };
    out.push({ kind: "library", source: input.source, nativeId: input.nativeId, ...snap });
  }
  return out;
}

function resourceKey(r: HomeworkResource): string {
  switch (r.kind) {
    case "material": return `material:${r.materialId}`;
    case "game": return gameResourceKey(r.lessonId, r.game);
    default: return `${r.source}:${r.nativeId}`;
  }
}

/** The homework's line in its class chat. Never fails the caller: the homework itself is saved. */
async function shareToChat(hw: Homework, klass: ClassGroup): Promise<boolean> {
  try {
    const body = homeworkChatLine({
      title: hw.title,
      dueDate: dueAtToDueDate(hw.dueAt),
      instructions: hw.instructions,
      resourceTitles: hw.resources.map(r => r.title),
    });
    await postToClassThread(klass, body);
    return true;
  } catch (err) {
    logger.error({ err, homeworkId: hw.id }, "homework: posting to the class chat failed");
    return false;
  }
}

/** A homework row the teacher owns, not archived, whose class is also live. */
async function ownedHomework(id: string, teacherId: string): Promise<Homework | undefined> {
  if (!isUuid(id)) return undefined;
  const [row] = await db
    .select({ hw: homework })
    .from(homework)
    .innerJoin(classGroups, eq(classGroups.id, homework.classGroupId))
    .where(
      and(
        eq(homework.id, id),
        eq(homework.teacherId, teacherId),
        isNull(homework.archivedAt),
        isNull(classGroups.archivedAt),
      ),
    )
    .limit(1);
  return row?.hw;
}

/**
 * Per class: live roster rows currently in it, and how many of those have a
 * student account (a `self` link to any user). The second is what "done" can
 * ever reach — a class of children with no accounts shows 0 of N, which a
 * teacher must not read as "nobody did it".
 */
async function classSizes(classIds: string[]): Promise<Map<string, { students: number; trackable: number }>> {
  const rows = await db
    .select({
      classId: classMemberships.classGroupId,
      n: countDistinct(students.id),
      t: countDistinct(rosterLinks.studentId),
    })
    .from(classMemberships)
    .innerJoin(students, eq(students.id, classMemberships.studentId))
    .leftJoin(rosterLinks, and(eq(rosterLinks.studentId, students.id), eq(rosterLinks.relation, "self")))
    .where(and(inArray(classMemberships.classGroupId, classIds), isNull(students.archivedAt)))
    .groupBy(classMemberships.classGroupId);
  return new Map(rows.map(r => [r.classId, { students: Number(r.n), trackable: Number(r.t) }]));
}

/**
 * Attach the numbers. Both count only roster rows that are live (not archived)
 * AND currently in the class: a child who left, or whose row was archived,
 * stops being part of "how many have done it" even though their completion row
 * is kept.
 */
async function withCounts(rows: Homework[]): Promise<TeacherHomework[]> {
  if (rows.length === 0) return [];
  const classIds = [...new Set(rows.map(r => r.classGroupId))];
  const homeworkIds = rows.map(r => r.id);
  const examIds = [...new Set(rows.map(r => r.evaluationId).filter((v): v is string => !!v))];

  const [sizes, doneCounts, exams] = await Promise.all([
    classSizes(classIds),
    db
      .select({ homeworkId: homeworkCompletions.homeworkId, n: count() })
      .from(homeworkCompletions)
      .innerJoin(homework, eq(homework.id, homeworkCompletions.homeworkId))
      .innerJoin(
        classMemberships,
        and(
          eq(classMemberships.classGroupId, homework.classGroupId),
          eq(classMemberships.studentId, homeworkCompletions.studentId),
        ),
      )
      .innerJoin(students, eq(students.id, homeworkCompletions.studentId))
      .where(and(inArray(homeworkCompletions.homeworkId, homeworkIds), isNull(students.archivedAt)))
      .groupBy(homeworkCompletions.homeworkId),
    examIds.length === 0
      ? Promise.resolve([] as Array<{ id: string; title: string; titleAr: string }>)
      : db
          .select({ id: evaluations.id, title: evaluations.title, titleAr: evaluations.titleAr })
          .from(evaluations)
          .where(inArray(evaluations.id, examIds)),
  ]);

  const done = new Map(doneCounts.map(c => [c.homeworkId, Number(c.n)]));
  const examTitle = new Map(exams.map(e => [e.id, e.titleAr || e.title]));

  return rows.map(r => ({
    id: r.id,
    classGroupId: r.classGroupId,
    title: r.title,
    instructions: r.instructions,
    dueDate: dueAtToDueDate(r.dueAt),
    dueAt: r.dueAt.toISOString(),
    evaluationId: r.evaluationId,
    examTitle: r.evaluationId ? (examTitle.get(r.evaluationId) ?? null) : null,
    resources: r.resources,
    doneCount: done.get(r.id) ?? 0,
    studentCount: sizes.get(r.classGroupId)?.students ?? 0,
    trackableCount: sizes.get(r.classGroupId)?.trackable ?? 0,
  }));
}

router.post("/homework", async (req: AuthenticatedRequest, res) => {
  const parsed = parseCreate(req.body);
  if (!parsed.ok) {
    res.status(400).json(parseFailure(parsed));
    return;
  }
  const input = parsed.value;
  try {
    const teacherId = req.user!.id;
    const klass = await findLiveClass(input.classGroupId, teacherId);
    if (!klass) {
      res.status(404).json(NO_CLASS);
      return;
    }
    if (input.evaluationId && !(await examOk(input.evaluationId, teacherId, input.classGroupId))) {
      res.status(400).json(BAD_EXAM);
      return;
    }
    const resources = await resolveResources(input.resources, teacherId);
    if ("error" in resources) {
      res.status(400).json(resources);
      return;
    }
    const [row] = await db
      .insert(homework)
      .values({
        teacherId,
        classGroupId: input.classGroupId,
        title: input.title,
        instructions: input.instructions,
        dueAt: input.dueAt,
        evaluationId: input.evaluationId,
        resources,
      })
      .returning();
    const [out] = await withCounts([row!]);
    // Tell the class's families before answering — awaited, capped, never
    // failing the post (lib/pushWithin.ts says why not fire-and-forget).
    await pushWithin("homework posted", () => announceHomeworkPosted(row!, klass));
    const sharedToChat = req.body?.shareToChat === true ? await shareToChat(row!, klass) : false;
    res.status(201).json({ homework: out, sharedToChat });
  } catch (err) {
    failHomework(res, err, "create homework");
  }
});

// The guard is on the route itself: this path lives under /classes, which the
// roster router already guards, and an extra router-level `use` for "/classes"
// here would be exactly the unscoped middleware CLAUDE.md warns about.
router.get(
  "/classes/:id/homework",
  authMiddleware,
  requireRole(...TEACHER_ROLES),
  async (req: AuthenticatedRequest, res) => {
    try {
      const klass = await findLiveClass(String(req.params["id"]), req.user!.id);
      if (!klass) {
        res.status(404).json(NO_CLASS);
        return;
      }
      const rows = await db
        .select()
        .from(homework)
        .where(and(eq(homework.classGroupId, klass.id), eq(homework.teacherId, req.user!.id), isNull(homework.archivedAt)))
        .orderBy(desc(homework.dueAt), desc(homework.createdAt))
        .limit(LIST_LIMIT);
      const items = await withCounts(rows);
      // An empty list still needs the class size.
      const size = (await classSizes([klass.id])).get(klass.id);
      res.json({ studentCount: size?.students ?? 0, trackableCount: size?.trackable ?? 0, homework: items });
    } catch (err) {
      failHomework(res, err, "load homework");
    }
  },
);

router.patch("/homework/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const teacherId = req.user!.id;
    const existing = await ownedHomework(String(req.params["id"]), teacherId);
    if (!existing) {
      res.status(404).json(NO_HOMEWORK);
      return;
    }
    const parsed = parsePatch(req.body, new Date(), existing);
    if (!parsed.ok) {
      res.status(400).json(parseFailure(parsed));
      return;
    }
    const patch = parsed.value;
    // An unchanged link is not re-checked: once the exam is archived (or moved),
    // re-validating it would make every other edit to this homework a 400. Only
    // a NEW exam must be live and in this class; null (detach) needs no check.
    if (
      patch.evaluationId &&
      patch.evaluationId !== existing.evaluationId &&
      !(await examOk(patch.evaluationId, teacherId, existing.classGroupId))
    ) {
      res.status(400).json(BAD_EXAM);
      return;
    }
    let resources: HomeworkResource[] | undefined;
    if (patch.resources !== undefined) {
      const r = await resolveResources(patch.resources, teacherId, existing.resources);
      if ("error" in r) {
        res.status(400).json(r);
        return;
      }
      // An app from before games drops the game items it cannot read and sends
      // the rest back; without `gamesIncluded: true` the games it omitted stay.
      resources = req.body?.gamesIncluded === true ? r : carryOverGames(r, existing.resources, RESOURCES_MAX);
    }
    // Only fields parsePatch produced, never `...req.body`: the class and the
    // teacher are not editable, whatever the client sends.
    const [row] = await db
      .update(homework)
      .set({
        ...(patch.title !== undefined && { title: patch.title }),
        ...(patch.instructions !== undefined && { instructions: patch.instructions }),
        ...(patch.dueAt !== undefined && { dueAt: patch.dueAt }),
        ...(patch.evaluationId !== undefined && { evaluationId: patch.evaluationId }),
        ...(resources !== undefined && { resources }),
        updatedAt: new Date(),
      })
      .where(and(eq(homework.id, existing.id), eq(homework.teacherId, teacherId), isNull(homework.archivedAt)))
      .returning();
    if (!row) {
      res.status(404).json(NO_HOMEWORK);
      return;
    }
    const [out] = await withCounts([row]);
    res.json({ homework: out });
  } catch (err) {
    failHomework(res, err, "update homework");
  }
});

/**
 * Who played which attached game, and how well. Only children who are live
 * members of the class right now (the same rule `withCounts` counts "done" by);
 * a child who left keeps the row but drops out of this list.
 */
router.get("/homework/:id/game-results", async (req: AuthenticatedRequest, res) => {
  try {
    const existing = await ownedHomework(String(req.params["id"]), req.user!.id);
    if (!existing) {
      res.status(404).json(NO_HOMEWORK);
      return;
    }
    const rows = await db
      .select({
        studentId: gameResults.studentId,
        displayName: students.displayName,
        lessonId: gameResults.lessonId,
        game: gameResults.game,
        score: gameResults.score,
        total: gameResults.total,
        attempts: gameResults.attempts,
        playedAt: gameResults.playedAt,
      })
      .from(gameResults)
      .innerJoin(
        classMemberships,
        and(eq(classMemberships.classGroupId, existing.classGroupId), eq(classMemberships.studentId, gameResults.studentId)),
      )
      .innerJoin(students, eq(students.id, gameResults.studentId))
      .where(and(eq(gameResults.homeworkId, existing.id), isNull(students.archivedAt)))
      .orderBy(asc(students.displayName), asc(gameResults.game), asc(gameResults.lessonId));
    // Only what is attached now: a detached game's rows stay in the table but are not reported.
    const attached = new Set(attachedGames(existing.resources).map(g => gameResourceKey(g.lessonId, g.game as GameKind)));
    res.json({
      results: rows
        .filter(r => attached.has(gameResourceKey(r.lessonId, r.game as GameKind)))
        .map(r => ({ ...r, playedAt: r.playedAt.toISOString() })),
    });
  } catch (err) {
    failHomework(res, err, "load game results");
  }
});

/** Leaves the homework's line in its class chat, for one posted without it (or to remind). */
router.post("/homework/:id/share", async (req: AuthenticatedRequest, res) => {
  try {
    const teacherId = req.user!.id;
    const existing = await ownedHomework(String(req.params["id"]), teacherId);
    const klass = existing && (await findLiveClass(existing.classGroupId, teacherId));
    if (!existing || !klass) {
      res.status(404).json(NO_HOMEWORK);
      return;
    }
    if (!(await shareToChat(existing, klass))) {
      res.status(500).json({ error: "Failed to post to the class chat" });
      return;
    }
    res.json({ shared: existing.id });
  } catch (err) {
    failHomework(res, err, "share homework");
  }
});

/** Archives rather than deletes: completions are kept, and readers filter on archived_at. */
router.delete("/homework/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const teacherId = req.user!.id;
    const existing = await ownedHomework(String(req.params["id"]), teacherId);
    if (!existing) {
      res.status(404).json(NO_HOMEWORK);
      return;
    }
    await db
      .update(homework)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(homework.id, existing.id), eq(homework.teacherId, teacherId)));
    res.json({ archived: existing.id });
  } catch (err) {
    failHomework(res, err, "delete homework");
  }
});

export default router;
