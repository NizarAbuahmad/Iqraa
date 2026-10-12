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
 * No `requireRosterConsent`: that gate is about entering a child's information,
 * and homework carries none. Guards are path-scoped (see mountOrder.test.ts):
 * a bare `router.use(mw)` here would guard every router mounted after it.
 */
import { Router, type Response } from "express";
import { db } from "@workspace/db";
import { classGroups, classMemberships, evaluations, homework, homeworkCompletions, rosterLinks, students, type Homework } from "@workspace/db";
import { and, count, countDistinct, desc, eq, inArray, isNull } from "drizzle-orm";
import { authMiddleware, requireRole, TEACHER_ROLES, type AuthenticatedRequest } from "../middlewares/auth.js";
import { findLiveClass } from "../lib/classOwnership.js";
import { logger } from "../lib/logger";
import { isSchemaMissing } from "../lib/schemaMissing.js";
import { dueAtToDueDate, isUuid, parseCreate, parsePatch } from "../modules/homework/rules.ts";

const router = Router();

router.use("/homework", authMiddleware, requireRole(...TEACHER_ROLES));

const NO_CLASS = { error: "Class not found" } as const;
const NO_HOMEWORK = { error: "Homework not found" } as const;
const BAD_EXAM = { error: "That exam is not attached to this class" } as const;
const LIST_LIMIT = 100;

interface TeacherHomework {
  id: string;
  classGroupId: string;
  title: string;
  instructions: string;
  dueDate: string;
  dueAt: string;
  evaluationId: string | null;
  examTitle: string | null;
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
    if (!(await findLiveClass(input.classGroupId, teacherId))) {
      res.status(404).json(NO_CLASS);
      return;
    }
    if (input.evaluationId && !(await examOk(input.evaluationId, teacherId, input.classGroupId))) {
      res.status(400).json(BAD_EXAM);
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
      })
      .returning();
    const [out] = await withCounts([row!]);
    res.status(201).json({ homework: out });
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
    // Only fields parsePatch produced, never `...req.body`: the class and the
    // teacher are not editable, whatever the client sends.
    const [row] = await db
      .update(homework)
      .set({
        ...(patch.title !== undefined && { title: patch.title }),
        ...(patch.instructions !== undefined && { instructions: patch.instructions }),
        ...(patch.dueAt !== undefined && { dueAt: patch.dueAt }),
        ...(patch.evaluationId !== undefined && { evaluationId: patch.evaluationId }),
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
