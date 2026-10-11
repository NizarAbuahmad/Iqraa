/**
 * The exam calendar: a teacher's own dated exams, plus — when an admin has put
 * them in a school — their colleagues', so two exams for one grade do not land
 * on the same day.
 *
 * This is the only route where one teacher's data reaches another, which is why
 * the shape of what colleagues see is decided in `lib/examCalendar.ts` (and
 * tested there) rather than here. See lib/db/src/schema/schools.ts.
 */
import { Router } from "express";
import { classGroups, db, evaluations, schools, users } from "@workspace/db";
import { and, between, eq, isNotNull, isNull, ne, or } from "drizzle-orm";
import {
  authMiddleware,
  requireRole,
  TEACHER_ROLES,
  type AuthenticatedRequest,
} from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";
import { isSchemaMissing } from "../lib/schemaMissing.js";
import { parseCalendarRange } from "../lib/examDate.js";
import { buildCalendarEntries, type CalendarRow } from "../lib/examCalendar.js";

const router = Router();

// Scoped to this router's own path — a bare `router.use(mw)` here would guard
// every router mounted after it. routes/__tests__/mountOrder.test.ts asserts it.
router.use("/exam-calendar", authMiddleware, requireRole(...TEACHER_ROLES));

/**
 * GET /exam-calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * → { school: { id, name } | null, exams: CalendarEntry[] }
 *
 * `school: null` means the teacher has not been placed in one: they get their
 * own exams only, and the client can say why colleagues' are missing.
 */
router.get("/exam-calendar", async (req: AuthenticatedRequest, res) => {
  let range: { from: string; to: string };
  try {
    range = parseCalendarRange(req.query as { from?: unknown; to?: unknown });
  } catch (msg) {
    res.status(400).json({ error: String(msg) });
    return;
  }

  try {
    const viewerId = req.user!.id;
    const [viewer] = await db
      .select({ schoolId: users.schoolId })
      .from(users)
      .where(eq(users.id, viewerId))
      .limit(1);
    const schoolId = viewer?.schoolId ?? null;

    const [school] = schoolId
      ? await db.select({ id: schools.id, name: schools.name }).from(schools).where(eq(schools.id, schoolId)).limit(1)
      : [];

    const rows = await db
      .select({
        id: evaluations.id,
        teacherId: evaluations.teacherId,
        teacherFirst: users.firstName,
        teacherLast: users.lastName,
        title: evaluations.title,
        titleAr: evaluations.titleAr,
        examDate: evaluations.examDate,
        examTime: evaluations.examTime,
        gradeId: evaluations.gradeId,
        subjectId: evaluations.subjectId,
        status: evaluations.status,
        archivedAt: evaluations.archivedAt,
        className: classGroups.name,
        classNameAr: classGroups.nameAr,
      })
      .from(evaluations)
      .innerJoin(users, eq(users.id, evaluations.teacherId))
      .leftJoin(classGroups, eq(classGroups.id, evaluations.classGroupId))
      .where(
        and(
          isNotNull(evaluations.examDate),
          between(evaluations.examDate, range.from, range.to),
          isNull(evaluations.archivedAt),
          ne(evaluations.status, "closed"),
          // Own exams always; colleagues' only inside the same school. With no
          // school the second arm is absent, so nothing else can match.
          schoolId
            ? or(eq(evaluations.teacherId, viewerId), eq(users.schoolId, schoolId))
            : eq(evaluations.teacherId, viewerId),
        ),
      );

    const calendarRows: CalendarRow[] = rows.map(r => ({
      id: r.id,
      teacherId: r.teacherId,
      teacherName: `${r.teacherFirst} ${r.teacherLast}`.trim(),
      title: r.title,
      titleAr: r.titleAr,
      examDate: r.examDate,
      examTime: r.examTime,
      gradeId: r.gradeId,
      subjectId: r.subjectId,
      status: r.status,
      archivedAt: r.archivedAt,
      className: r.className ?? "",
      classNameAr: r.classNameAr ?? "",
    }));

    res.json({
      school: school ?? null,
      exams: buildCalendarEntries(calendarRows, viewerId),
    });
  } catch (err) {
    if (isSchemaMissing(err)) {
      logger.error({ err }, "exam calendar failed — a table or column is missing from this database");
      res.status(503).json({ error: "Exam calendar is unavailable", code: "exam_calendar_unavailable" });
      return;
    }
    logger.error({ err }, "exam calendar failed");
    res.status(500).json({ error: "Failed to load the exam calendar" });
  }
});

export default router;
