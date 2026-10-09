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
  attemptRetakes,
  attempts,
  classGroups,
  classMemberships,
  evaluations,
  masteryOverrides,
  rosterLinks,
  students,
} from "@workspace/db";
import { and, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { lessonIdsForObjectiveIds } from "@workspace/curriculum";
import { authMiddleware, requireRole, type AuthenticatedRequest } from "../middlewares/auth.js";
import { masteryGateEnabled, studentAccountsEnabled } from "../lib/features.js";
import { logger } from "../lib/logger";
import { isSchemaMissing } from "../lib/schemaMissing.js";
import { studentGradeIds } from "../lib/studentGrades.ts";
import {
  MASTERY_PASS_PERCENT,
  quizLessonIds,
  studentLessonProgress,
  withUnlocks,
} from "../modules/assessment/lessonProgress.ts";
import { audioKeysForAttempt, deleteAttemptAudio } from "../lib/attemptAudio.ts";
import { retakeDecision } from "../modules/assessment/retake.ts";
import {
  guardianExamRow,
  sortStudentExams,
  studentExamRow,
  type ResultForStudent,
  type SittingForStudent,
  type StudentExamRow,
} from "../modules/assessment/studentExams.ts";

const router = Router();

router.use("/student", authMiddleware, requireRole("student"));
router.use("/parent", authMiddleware, requireRole("parent"));

/** Every live roster row this account is `self`-linked to. */
async function selfLinkedStudentIds(userId: string): Promise<string[]> {
  const linked = await db
    .select({ studentId: rosterLinks.studentId })
    .from(rosterLinks)
    .innerJoin(students, eq(students.id, rosterLinks.studentId))
    .where(and(eq(rosterLinks.userId, userId), eq(rosterLinks.relation, "self"), isNull(students.archivedAt)));
  return [...new Set(linked.map(l => l.studentId))];
}

interface RetakeCandidate {
  attemptId: string;
  evaluationId: string;
  studentId: string;
  shareCode: string | null;
  decision: ReturnType<typeof retakeDecision>;
  failedPercent: unknown;
}

/**
 * Every submitted sitting these roster rows hold, each with the verdict on
 * whether it may be thrown away for a retake. Shared by `/student/progress`
 * (which lists the eligible ones) and the retake route (which acts on one),
 * so "may retake" is decided in exactly one place. Throws a missing-table
 * error if `attempt_retakes` has not been pushed; callers decide what that means.
 */
async function loadRetakeCandidates(studentIds: string[], now: Date): Promise<RetakeCandidate[]> {
  if (studentIds.length === 0) return [];
  const sittings = await db
    .select({
      attemptId: attempts.id,
      evaluationId: attempts.evaluationId,
      studentId: attempts.studentId,
      source: attempts.source,
      submittedAt: attempts.submittedAt,
      percent: attemptResults.percent,
      isProvisional: attemptResults.isProvisional,
      objectiveIds: evaluations.objectiveIds,
      status: evaluations.status,
      released: evaluations.releaseResultsToStudent,
      shareCode: evaluations.shareCode,
      shareCodeExpiresAt: evaluations.shareCodeExpiresAt,
    })
    .from(attempts)
    .innerJoin(evaluations, eq(evaluations.id, attempts.evaluationId))
    .leftJoin(attemptResults, eq(attemptResults.attemptId, attempts.id))
    .where(and(inArray(attempts.studentId, studentIds), isNotNull(attempts.submittedAt)));

  const used = await db
    .select({
      evaluationId: attemptRetakes.evaluationId,
      studentId: attemptRetakes.studentId,
      n: sql<number>`count(*)::int`,
    })
    .from(attemptRetakes)
    .where(inArray(attemptRetakes.studentId, studentIds))
    .groupBy(attemptRetakes.evaluationId, attemptRetakes.studentId);
  const usedBy = new Map(used.map(u => [`${u.evaluationId}:${u.studentId}`, u.n]));

  return sittings.map(s => ({
    attemptId: s.attemptId,
    evaluationId: s.evaluationId,
    studentId: s.studentId,
    shareCode: s.shareCode,
    failedPercent: s.percent,
    decision: retakeDecision({
      submitted: s.submittedAt !== null,
      studentSitting: s.source === "student_link",
      released: s.released,
      // No result row means grading never ran; treat it as not final.
      isProvisional: s.isProvisional ?? true,
      percent: s.percent,
      threshold: MASTERY_PASS_PERCENT,
      retakesUsed: usedBy.get(`${s.evaluationId}:${s.studentId}`) ?? 0,
      singleLesson: lessonIdsForObjectiveIds(s.objectiveIds).length === 1,
      open: s.status === "published" && (!s.shareCodeExpiresAt || s.shareCodeExpiresAt.getTime() > now.getTime()),
    }),
  }));
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

/**
 * Every exam a set of roster rows has, as rows the list can render. One
 * function for both lists, so a student and their parent can never disagree
 * about what is released.
 */
async function examRowsFor(studentIds: string[]): Promise<StudentExamRow[]> {
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
  if (!where) return [];

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

  return sortStudentExams(rows);
}

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

    res.json({ exams: await examRowsFor(studentIds) });
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
 * back, never marks, and nothing about a paper the teacher has not released
 * (`releaseResultsToStudent`): until then its lesson is in `awaitingLessonIds`
 * — handed in, waiting for the teacher — and is neither passed nor offered a
 * retake. What counts is `studentLessonProgress` and `retakeDecision`.
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
      res.json({
        enabled: false,
        passedLessonIds: [],
        awaitingLessonIds: [],
        quizLessonIds: [],
        retakeEvaluationIds: [],
        threshold: MASTERY_PASS_PERCENT,
      });
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

    // Every handed-in sitting, graded or not: one with no result row yet is
    // still "waiting for your teacher", never passed.
    const sittings = studentIds.length
      ? (
          await db
            .select({
              objectiveIds: evaluations.objectiveIds,
              percent: attemptResults.percent,
              isProvisional: attemptResults.isProvisional,
              released: evaluations.releaseResultsToStudent,
            })
            .from(attempts)
            .leftJoin(attemptResults, eq(attemptResults.attemptId, attempts.id))
            .innerJoin(evaluations, eq(evaluations.id, attempts.evaluationId))
            .where(and(inArray(attempts.studentId, studentIds), isNotNull(attempts.submittedAt)))
        ).map(s => ({ ...s, isProvisional: s.isProvisional ?? true }))
      : [];
    const lessons = studentLessonProgress(sittings, lessonIdsForObjectiveIds);

    // Which failed quizzes could be retaken. If `attempt_retakes` has not been
    // pushed yet, offer none rather than failing the whole gate.
    let retakeEvaluationIds: string[] = [];
    try {
      retakeEvaluationIds = (await loadRetakeCandidates(studentIds, now))
        .filter(c => c.decision.ok)
        .map(c => c.evaluationId);
    } catch (err) {
      if (!isSchemaMissing(err)) throw err;
      logger.error({ err }, "attempt_retakes is missing from this database; offering no retakes");
    }

    // Lessons a teacher has let this student through. If the table has not
    // been pushed yet there are none to count; the student just stays gated.
    let unlockedLessonIds: string[] = [];
    if (studentIds.length > 0) {
      try {
        unlockedLessonIds = (
          await db
            .select({ lessonId: masteryOverrides.lessonId })
            .from(masteryOverrides)
            .where(inArray(masteryOverrides.studentId, studentIds))
        ).map(o => o.lessonId);
      } catch (err) {
        if (!isSchemaMissing(err)) throw err;
        logger.error({ err }, "mastery_overrides is missing from this database; counting no unlocks");
      }
    }

    res.json({
      enabled: true,
      passedLessonIds: withUnlocks(lessons.passed, unlockedLessonIds),
      awaitingLessonIds: lessons.awaiting,
      quizLessonIds: quizLessonIds(openExams, lessonIdsForObjectiveIds),
      retakeEvaluationIds: [...new Set(retakeEvaluationIds)],
      threshold: MASTERY_PASS_PERCENT,
    });
  } catch (err) {
    logger.error({ err }, "student progress failed");
    res.status(500).json({ error: "Failed to load your progress" });
  }
});

/**
 * Throw away a failed lesson-quiz sitting so the student can sit it again.
 *
 * Deletes the `attempts` row (answers, grades and result go with it by
 * cascade) and records the discarded mark in `attempt_retakes`, so the next
 * `/take/:code/claim-self` starts a clean sitting through the ordinary path.
 * Whether it is allowed is `retakeDecision`; the refusal code is returned so
 * the app can say why. The delete and the record are one transaction, and the
 * delete is guarded on `submitted_at`, so two taps cannot both succeed.
 */
router.post("/student/exams/:evaluationId/retake", async (req: AuthenticatedRequest, res) => {
  try {
    if (!studentAccountsEnabled()) {
      res.status(403).json({
        code: "student_accounts_disabled",
        error: "Parent and student accounts are not available yet.",
      });
      return;
    }
    if (!masteryGateEnabled()) {
      res.status(403).json({ code: "mastery_gate_disabled", error: "Retakes are not available." });
      return;
    }

    const studentIds = await selfLinkedStudentIds(req.user!.id);
    const evaluationId = req.params["evaluationId"] as string;
    const candidate = (await loadRetakeCandidates(studentIds, new Date())).find(
      c => c.evaluationId === evaluationId,
    );
    if (!candidate) {
      res.status(404).json({ code: "no_sitting", error: "You have no finished sitting on this exam." });
      return;
    }
    if (!candidate.decision.ok) {
      res.status(409).json({ code: candidate.decision.code, error: "This quiz cannot be retaken." });
      return;
    }

    const failedPercent = Number(candidate.failedPercent);
    // Read before the cascade removes the rows that name them, deleted after
    // commit — otherwise a minor's recordings stay in R2 with nothing pointing at them.
    const audioKeys = await audioKeysForAttempt(candidate.attemptId);
    const done = await db.transaction(async tx => {
      const removed = await tx
        .delete(attempts)
        .where(and(eq(attempts.id, candidate.attemptId), isNotNull(attempts.submittedAt)))
        .returning({ id: attempts.id });
      if (removed.length === 0) return false;
      await tx.insert(attemptRetakes).values({
        evaluationId: candidate.evaluationId,
        studentId: candidate.studentId,
        failedPercent: (Number.isFinite(failedPercent) ? failedPercent : 0).toFixed(2),
      });
      return true;
    });
    if (!done) {
      res.status(409).json({ code: "already_reset", error: "This sitting was already reset." });
      return;
    }
    await deleteAttemptAudio(audioKeys, { attemptId: candidate.attemptId, reason: "retake" });
    res.json({ ok: true, shareCode: candidate.shareCode });
  } catch (err) {
    if (isSchemaMissing(err)) {
      logger.error({ err }, "retake failed — attempt_retakes table is missing from this database");
      res.status(503).json({ code: "retakes_unavailable", error: "Retakes are not set up on this server yet." });
      return;
    }
    logger.error({ err }, "student retake failed");
    res.status(500).json({ error: "Failed to reset this quiz" });
  }
});

/**
 * A parent's view of the same lists, one per child: every roster row this
 * account is `guardian`-linked to. Results follow the student's release rule
 * exactly (`examRowsFor` → `studentExamRow`), so a parent sees a mark when —
 * and only when — the child can; no row carries the exam link.
 */
router.get("/parent/exams", async (req: AuthenticatedRequest, res) => {
  try {
    if (!studentAccountsEnabled()) {
      res.status(403).json({
        code: "student_accounts_disabled",
        error: "Parent and student accounts are not available yet.",
      });
      return;
    }

    const linked = await db
      .select({ studentId: students.id, displayName: students.displayName })
      .from(rosterLinks)
      .innerJoin(students, eq(students.id, rosterLinks.studentId))
      .where(
        and(
          eq(rosterLinks.userId, req.user!.id),
          eq(rosterLinks.relation, "guardian"),
          isNull(students.archivedAt),
        ),
      );
    const children = [...new Map(linked.map(l => [l.studentId, l])).values()];

    const lists = await Promise.all(
      children.map(async child => ({
        studentId: child.studentId,
        displayName: child.displayName,
        exams: (await examRowsFor([child.studentId])).map(guardianExamRow),
      })),
    );
    res.json({ children: lists });
  } catch (err) {
    logger.error({ err }, "parent exam list failed");
    res.status(500).json({ error: "Failed to load your children's exams" });
  }
});

export default router;
