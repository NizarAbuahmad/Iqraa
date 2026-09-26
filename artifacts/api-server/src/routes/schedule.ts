/**
 * A teacher's weekly period timetable — see lib/db/src/schema/schedule.ts for
 * why this is two tables and how it differs from teachingPlans.ts.
 *
 * No student data here, so unlike roster.ts this does not need
 * `requireRosterConsent`.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { schedulePeriods, scheduleSlots } from "@workspace/db";
import { and, asc, eq } from "drizzle-orm";
import {
  authMiddleware,
  requireRole,
  TEACHER_ROLES,
  type AuthenticatedRequest,
} from "../middlewares/auth.js";
import { logger } from "../lib/logger";
import { isSchemaMissing } from "../lib/schemaMissing.js";
import { resolveClassGroupId } from "../lib/classOwnership.js";
import {
  isValidDayOfWeek,
  isValidPeriodNumber,
  parsePeriodInput,
  parseSchoolName,
  parseSlotInput,
} from "../lib/schedule.js";

const router = Router();

// Scoped to this router's own path — see the mount-order warning in
// teachingPlans.ts and CLAUDE.md: a bare `router.use(mw)` here would guard
// every router mounted after it.
router.use("/schedule", authMiddleware, requireRole(...TEACHER_ROLES));

/** Single exit for every schedule failure: 503 + a code when the schema is absent. */
function failSchedule(
  res: Parameters<Parameters<typeof router.get>[1]>[1],
  err: unknown,
  action: string,
): void {
  if (isSchemaMissing(err)) {
    logger.error(
      { err },
      `${action} failed — a schedule table is missing from this database. ` +
        "Run `pnpm --filter @workspace/db run push` against DATABASE_URL.",
    );
    res.status(503).json({
      code: "schedule_storage_unavailable",
      error: "Schedule storage is not set up on this server yet.",
    });
    return;
  }
  logger.error({ err }, `${action} failed`);
  res.status(500).json({ error: `Failed to ${action}` });
}

/** The whole grid in one call: every period's time, and every filled slot. */
router.get("/schedule", async (req: AuthenticatedRequest, res) => {
  try {
    const [periods, slots] = await Promise.all([
      db
        .select()
        .from(schedulePeriods)
        .where(eq(schedulePeriods.teacherId, req.user!.id))
        .orderBy(asc(schedulePeriods.periodNumber)),
      db
        .select()
        .from(scheduleSlots)
        .where(eq(scheduleSlots.teacherId, req.user!.id))
        .orderBy(asc(scheduleSlots.dayOfWeek), asc(scheduleSlots.periodNumber)),
    ]);
    res.json({ periods, slots });
  } catch (err) {
    failSchedule(res, err, "load schedule");
  }
});

/** Set (or move/resize) period N's time. periodNumber is per-teacher, not global — see schema.ts. */
router.put("/schedule/periods/:periodNumber", async (req: AuthenticatedRequest, res) => {
  const periodNumber = Number(req.params["periodNumber"]);
  if (!isValidPeriodNumber(periodNumber)) {
    res.status(400).json({ error: "periodNumber must be a whole number between 1 and 12" });
    return;
  }

  let input;
  let schoolName: string;
  try {
    input = parsePeriodInput(req.body);
    schoolName = parseSchoolName((req.body as { schoolName?: unknown }).schoolName);
  } catch (msg) {
    res.status(400).json({ error: String(msg) });
    return;
  }

  try {
    const [row] = await db
      .insert(schedulePeriods)
      .values({ teacherId: req.user!.id, schoolName, periodNumber, ...input })
      .onConflictDoUpdate({
        target: [schedulePeriods.teacherId, schedulePeriods.schoolName, schedulePeriods.periodNumber],
        set: { startTime: input.startTime, durationMinutes: input.durationMinutes, updatedAt: new Date() },
      })
      .returning();
    res.json({ period: row });
  } catch (err) {
    failSchedule(res, err, "save period");
  }
});

/** Remove period N from the grid entirely — a school shortening its day. */
router.delete("/schedule/periods/:periodNumber", async (req: AuthenticatedRequest, res) => {
  const periodNumber = Number(req.params["periodNumber"]);
  if (!isValidPeriodNumber(periodNumber)) {
    res.status(400).json({ error: "periodNumber must be a whole number between 1 and 12" });
    return;
  }
  let schoolName: string;
  try {
    schoolName = parseSchoolName(req.query["school"]);
  } catch (msg) {
    res.status(400).json({ error: String(msg) });
    return;
  }

  try {
    await db
      .delete(schedulePeriods)
      .where(
        and(
          eq(schedulePeriods.teacherId, req.user!.id),
          eq(schedulePeriods.schoolName, schoolName),
          eq(schedulePeriods.periodNumber, periodNumber),
        ),
      );
    // A body, not a bare 204 — matches every other delete in this API
    // (teachingPlans.ts's `res.json({ archived: row.id })`), so the client's
    // one `readJson` helper never needs a body-less special case.
    res.json({ deleted: periodNumber });
  } catch (err) {
    failSchedule(res, err, "delete period");
  }
});

/**
 * Assign (or clear, with `classGroupId: null`) the class in one day+period
 * cell. One endpoint for both, matching the grid's own save-on-change UX —
 * there is no meaningful difference between "set this cell" and "unset it".
 */
router.put("/schedule/slots/:dayOfWeek/:periodNumber", async (req: AuthenticatedRequest, res) => {
  const dayOfWeek = Number(req.params["dayOfWeek"]);
  const periodNumber = Number(req.params["periodNumber"]);
  if (!isValidDayOfWeek(dayOfWeek) || !isValidPeriodNumber(periodNumber)) {
    res.status(400).json({ error: "dayOfWeek must be 0-6 and periodNumber must be 1-12" });
    return;
  }

  let input;
  let classGroupId: string | null | undefined;
  let schoolName: string;
  try {
    input = parseSlotInput(req.body);
    schoolName = parseSchoolName((req.body as { schoolName?: unknown }).schoolName);
    classGroupId = await resolveClassGroupId(input.classGroupId, req.user!.id);
  } catch (msg) {
    res.status(400).json({ error: String(msg) });
    return;
  }

  try {
    const [row] = await db
      .insert(scheduleSlots)
      .values({
        teacherId: req.user!.id,
        schoolName,
        dayOfWeek,
        periodNumber,
        classGroupId: classGroupId ?? null,
        notes: input.notes ?? "",
      })
      .onConflictDoUpdate({
        target: [scheduleSlots.teacherId, scheduleSlots.schoolName, scheduleSlots.dayOfWeek, scheduleSlots.periodNumber],
        set: {
          // `undefined` means "field omitted" (resolveClassGroupId already
          // turned that into undefined too), so an update that only sends
          // `notes` must not blank out the class already sitting in this slot.
          ...(classGroupId !== undefined ? { classGroupId } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          updatedAt: new Date(),
        },
      })
      .returning();
    res.json({ slot: row });
  } catch (err) {
    failSchedule(res, err, "save schedule slot");
  }
});

/**
 * Rename a school across both tables. Refuses to merge into a name that
 * already has periods: two bell schedules colliding on one key would make the
 * UPDATE fail halfway through a slot list, and silently picking one side's
 * times is worse than asking.
 */
router.put("/schedule/schools", async (req: AuthenticatedRequest, res) => {
  let from: string;
  let to: string;
  try {
    const body = (req.body ?? {}) as { from?: unknown; to?: unknown };
    from = parseSchoolName(body.from);
    to = parseSchoolName(body.to);
  } catch (msg) {
    res.status(400).json({ error: String(msg) });
    return;
  }
  const teacherId = req.user!.id;
  if (from === to) {
    res.json({ schoolName: to });
    return;
  }

  try {
    const [taken] = await db
      .select({ id: schedulePeriods.id })
      .from(schedulePeriods)
      .where(and(eq(schedulePeriods.teacherId, teacherId), eq(schedulePeriods.schoolName, to)))
      .limit(1);
    if (taken) {
      res.status(409).json({ code: "school_name_taken", error: "You already have a school with that name." });
      return;
    }
    await db.transaction(async tx => {
      await tx
        .update(schedulePeriods)
        .set({ schoolName: to, updatedAt: new Date() })
        .where(and(eq(schedulePeriods.teacherId, teacherId), eq(schedulePeriods.schoolName, from)));
      await tx
        .update(scheduleSlots)
        .set({ schoolName: to, updatedAt: new Date() })
        .where(and(eq(scheduleSlots.teacherId, teacherId), eq(scheduleSlots.schoolName, from)));
    });
    res.json({ schoolName: to });
  } catch (err) {
    failSchedule(res, err, "rename school");
  }
});

export default router;
