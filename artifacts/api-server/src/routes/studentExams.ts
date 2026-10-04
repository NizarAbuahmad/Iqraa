/**
 * «اختباراتي»: the exams a signed-in student has, and what each one says.
 *
 * Until this route the share link was the only way into an exam, and a
 * result was visible only on the hand-in screen of that one sitting. A
 * student who closed the tab had no way back to either.
 *
 * Which exams: every published or closed exam set to a class the student
 * sits in, plus any exam the student already holds a sitting on — a paper
 * the teacher typed in for them, or one from a class they have since left.
 * "The student" is every roster row this account is `self`-linked to; an
 * account can be linked in more than one teacher's class.
 *
 * What each row says is decided by `studentExamRow`, which is the part that
 * is tested: links only while `/take/:code` would admit them, results only
 * when `/take/attempt/result` would release them.
 *
 * Path-scoped guard, like every other router here — see `mountOrder.test.ts`.
 */
import { Router } from "express";
import {
  db,
  attemptResults,
  attempts,
  classGroups,
  classMemberships,
  evaluations,
  rosterLinks,
  students,
} from "@workspace/db";
import { and, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { lessonIdsForObjectiveIds } from "@workspace/curriculum";
import { authMiddleware, requireRole, type AuthenticatedRequest } from "../middlewares/auth.js";
import { masteryGateEnabled, studentAccountsEnabled } from "../lib/features.js";
import { logger } from "../lib/logger";
import { studentGradeIds } from "../lib/studentGrades.ts";
import { MASTERY_PASS_PERCENT, passedLessonIds, quizLessonIds } from "../modules/assessment/lessonProgress.ts";
import {
  sortStudentExams,
  studentExamRow,
  type ResultForStudent,
  type SittingForStudent,
} from "../modules/assessment/studentExams.ts";

const router = Router();

router.use("/student", authMiddleware, requireRole("student"));

/** Every live roster row this account is `self`-linked to. */
async function selfLinkedStudentIds(userId: string): Promise<string[]> {
  const linked = await db
    .select({ studentId: rosterLinks.studentId })
    .from(rosterLinks)
    .innerJoin(students, eq(students.id, rosterLinks.studentId))
    .where(and(eq(rosterLinks.userId, userId), eq(rosterLinks.relation, "self"), isNull(students.archivedAt)));
  return [...new Set(linked.map(l => l.studentId))];
}

/** How far a sitting has got, so a duplicate keeps the more advanced one. */
function progress(s: { submittedAt: Date | null }): number {
  return s.submittedAt ? 1 : 0;
}

/**
 * The grades this student is in, so the library and the curriculum browser
 * open on theirs rather than on the first grade in the catalog. Same live
 * rows as the exam list: self-linked, not archived, live classes only.
 */
router.get("/student/grades", async (req: AuthenticatedRequest, res) => {
  try {
    const rows = await db
      .select({ studentGradeId: students.gradeId, classGradeId: classGroups.gradeId })
      .from(rosterLinks)
      .innerJoin(students, eq(students.id, rosterLinks.studentId))
      .leftJoin(classMemberships, eq(classMemberships.studentId, students.id))
      .leftJoin(classGroups, and(eq(classGroups.id, classMemberships.classGroupId), isNull(classGroups.archivedAt)))
      .where(and(eq(rosterLinks.userId, req.user!.id), eq(rosterLinks.relation, "self"), isNull(students.archivedAt)));
    res.json({ gradeIds: studentGradeIds(rows) });
  } catch (err) {
    logger.error({ err }, "student grades failed");
    res.status(500).json({ error: "Failed to load your grade" });
  }
});

router.get("/student/exams", async (req: AuthenticatedRequest, res) => {
  try {
    if (!studentAccountsEnabled()) {
      res.status(403).json({
        code: "student_accounts_disabled",
        error: "Parent and student accounts are not available yet.",
      });
      return;
    }

    const studentIds = await selfLinkedStudentIds(req.user!.id);
    if (studentIds.length === 0) {
      res.json({ exams: [] });
      return;
    }

    // Live classes only: an archived class's exams are over, and any sitting
    // the student holds on one still comes back through `held` below.
    const memberships = await db
      .select({ classGroupId: classMemberships.classGroupId })
      .from(classMemberships)
      .innerJoin(classGroups, eq(classGroups.id, classMemberships.classGroupId))
      .where(and(inArray(classMemberships.studentId, studentIds), isNull(classGroups.archivedAt)));
    const classIds = [...new Set(memberships.map(m => m.classGroupId))];

    const held = await db
      .select({
        id: attempts.id,
        evaluationId: attempts.evaluationId,
        status: attempts.status,
        source: attempts.source,
        startedAt: attempts.startedAt,
        submittedAt: attempts.submittedAt,
      })
      .from(attempts)
      .where(inArray(attempts.studentId, studentIds));
    const heldEvaluationIds = [...new Set(held.map(a => a.evaluationId))];

    const setForClass = classIds.length
      ? and(inArray(evaluations.classGroupId, classIds), inArray(evaluations.status, ["published", "closed"]))
      : undefined;
    const alreadyHeld = heldEvaluationIds.length ? inArray(evaluations.id, heldEvaluationIds) : undefined;
    const where = setForClass && alreadyHeld ? or(setForClass, alreadyHeld) : (setForClass ?? alreadyHeld);
    if (!where) {
      res.json({ exams: [] });
      return;
    }

    const exams = await db
      .select({
        id: evaluations.id,
        title: evaluations.title,
        titleAr: evaluations.titleAr,
        subjectId: evaluations.subjectId,
        gradeId: evaluations.gradeId,
        status: evaluations.status,
        shareCode: evaluations.shareCode,
        shareCodeExpiresAt: evaluations.shareCodeExpiresAt,
        timeLimitMin: evaluations.timeLimitMin,
        totalMarks: evaluations.totalMarks,
        releaseResultsToStudent: evaluations.releaseResultsToStudent,
        publishedAt: evaluations.publishedAt,
        closedAt: evaluations.closedAt,
      })
      .from(evaluations)
      .where(where);

    // One sitting per student per exam is a database rule, but an account
    // linked to two roster rows could in principle hold one through each.
    // Keep the one that got further.
    const sittingByExam = new Map<string, (typeof held)[number]>();
    for (const a of held) {
      const prev = sittingByExam.get(a.evaluationId);
      if (!prev || progress(a) > progress(prev)) sittingByExam.set(a.evaluationId, a);
    }

    const attemptIds = [...sittingByExam.values()].filter(a => a.submittedAt).map(a => a.id);
    const results = attemptIds.length
      ? await db.select().from(attemptResults).where(inArray(attemptResults.attemptId, attemptIds))
      : [];
    const resultByAttempt = new Map(results.map(r => [r.attemptId, r]));

    const now = new Date();
    const rows = exams
      .map(exam => {
        const sitting = sittingByExam.get(exam.id) ?? null;
        const result = sitting ? (resultByAttempt.get(sitting.id) ?? null) : null;
        return studentExamRow(
          exam,
          sitting as SittingForStudent | null,
          result as ResultForStudent | null,
          now,
        );
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    res.json({ exams: sortStudentExams(rows) });
  } catch (err) {
    logger.error({ err }, "student exam list failed");
    res.status(500).json({ error: "Failed to load your exams" });
  }
});

/**
 * The lessons this student has passed, for the mastery gate.
 *
 * Reports `enabled: false` (and nothing else) until `MASTERY_GATE=true`, so a
 * client that asks before the pilot starts locks nothing. Only lesson ids come
 * back, never marks: whether a mark may be shown is the teacher's call
 * (`releaseResultsToStudent`), and "passed" is all an unlock needs to say.
 * What counts as passed is `passedLessonIds`.
 */
router.get("/student/progress", async (req: AuthenticatedRequest, res) => {
  try {
    if (!studentAccountsEnabled()) {
      res.status(403).json({
        code: "student_accounts_disabled",
        error: "Parent and student accounts are not available yet.",
      });
      return;
    }
    if (!masteryGateEnabled()) {
      res.json({ enabled: false, passedLessonIds: [], quizLessonIds: [], threshold: MASTERY_PASS_PERCENT });
      return;
    }

    const studentIds = await selfLinkedStudentIds(req.user!.id);

    // Quizzes the student could sit right now: published, link not expired,
    // set to a live class they are in. Closed or expired ones hold nobody back.
    const classIds = studentIds.length
      ? (
          await db
            .select({ classGroupId: classMemberships.classGroupId })
            .from(classMemberships)
            .innerJoin(classGroups, eq(classGroups.id, classMemberships.classGroupId))
            .where(and(inArray(classMemberships.studentId, studentIds), isNull(classGroups.archivedAt)))
        ).map(m => m.classGroupId)
      : [];
    const now = new Date();
    const openExams = classIds.length
      ? (
          await db
            .select({
              objectiveIds: evaluations.objectiveIds,
              shareCodeExpiresAt: evaluations.shareCodeExpiresAt,
            })
            .from(evaluations)
            .where(and(inArray(evaluations.classGroupId, [...new Set(classIds)]), eq(evaluations.status, "published")))
        ).filter(e => !e.shareCodeExpiresAt || e.shareCodeExpiresAt.getTime() > now.getTime())
      : [];

    const sittings = studentIds.length
      ? await db
          .select({
            objectiveIds: evaluations.objectiveIds,
            percent: attemptResults.percent,
            isProvisional: attemptResults.isProvisional,
          })
          .from(attempts)
          .innerJoin(attemptResults, eq(attemptResults.attemptId, attempts.id))
          .innerJoin(evaluations, eq(evaluations.id, attempts.evaluationId))
          .where(and(inArray(attempts.studentId, studentIds), isNotNull(attempts.submittedAt)))
      : [];

    res.json({
      enabled: true,
      passedLessonIds: passedLessonIds(sittings, lessonIdsForObjectiveIds),
      quizLessonIds: quizLessonIds(openExams, lessonIdsForObjectiveIds),
      threshold: MASTERY_PASS_PERCENT,
    });
  } catch (err) {
    logger.error({ err }, "student progress failed");
    res.status(500).json({ error: "Failed to load your progress" });
  }
});

export default router;
