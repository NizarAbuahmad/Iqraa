/**
 * The student side of an exam. **This is the only unauthenticated write
 * surface in the API**, so everything here is deliberate.
 *
 * A teacher publishes an exam and gets a short code. One link goes on the
 * board; each student opens it, taps their own name, and answers. There are no
 * student accounts — `students.ts` explains why — and the link is the identity.
 *
 * Four properties this file is responsible for:
 *
 * 1. **Answer keys never leave.** Questions go through
 *    `sanitizeQuestionForStudent`, an allowlist. The client is not trusted to
 *    hide anything, because the payload reaches the phone either way.
 * 2. **A name can be claimed once.** Two students cannot both be "سارة أحمد" —
 *    the second would overwrite the first's paper.
 * 3. **The token is the session.** Issued on claim, stored only as a hash,
 *    scoped to one attempt.
 * 4. **Nothing here can reach another exam.** Every lookup is anchored to the
 *    attempt the token names, or to the code in the path.
 *
 * The identity model is a deliberate trade. One link is what a teacher can
 * actually hand to thirty students; the cost is that a student can tap the
 * wrong name. That is contained by a confirm step, by names being
 * single-claim, by the teacher seeing who started — and, the real safety net,
 * by the teacher being able to move an attempt to the right student afterwards.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import {
  attemptAnswers,
  attempts,
  classMemberships,
  evaluationQuestions,
  evaluations,
  levelBands,
  students,
} from "@workspace/db";
import type { EvaluationQuestion } from "@workspace/db";
import { and, asc, eq, isNull } from "drizzle-orm";
import { lessonIdsForObjectiveIds } from "@workspace/curriculum";
import { logger } from "../lib/logger";
import { createRateLimiter } from "../lib/rateLimit";
import {
  hashAccessToken,
  issueAccessToken,
  normalizeShareCode,
  sanitizeQuestionForStudent,
} from "../modules/assessment/studentView";

const router = Router();

/**
 * Path-scoped, like every other guard in this API. A bare `router.use(...)`
 * here becomes middleware for every request that reaches this router — the
 * trap `mountOrder.test.ts` exists to catch.
 *
 * A classroom shares one IP, so thirty students must not rate-limit each
 * other. These ceilings are generous on purpose: they exist to stop a script
 * walking the code space, not to police a class.
 */
router.use("/take", createRateLimiter({ windowMs: 60_000, max: 240, name: "take" }));

/**
 * How long a student's session lasts. Longer than any sitting, short enough
 * that a token left on a borrowed phone stops working the same day.
 */
const TOKEN_TTL_MS = 6 * 60 * 60 * 1000;

async function evaluationByCode(rawCode: unknown) {
  const code = normalizeShareCode(rawCode);
  if (!code) return undefined;
  const [row] = await db
    .select()
    .from(evaluations)
    .where(eq(evaluations.shareCode, code))
    .limit(1);
  // A draft has nothing to sit and a closed exam is over. Both answer exactly
  // as a wrong code does — a public endpoint should not confirm which codes
  // exist.
  if (!row || row.status !== "published") return undefined;
  return row;
}

/**
 * The curriculum lessons a paper covers, for the student's figure panel.
 *
 * Sends lesson **ids**, not figures and not URIs. The figures are bundled into
 * the app by Metro at build time (`bookFigureAssets.ts`), so the client
 * resolves them locally and needs no bytes from here; and the URIs are
 * build-time bundle paths that differ between web and native, which this
 * server has no way to know. A short string is the whole contract.
 *
 * Objective ids themselves stay server-side: `sanitizeQuestionForStudent`
 * projects only `{id, orderIndex, type, marks, body}`, and widening that
 * allowlist to ship curriculum internals to an unauthenticated share-code
 * holder would be a bigger change than this feature earns.
 */
function lessonIdsForPaper(questions: readonly { objectiveId: string }[]): string[] {
  return lessonIdsForObjectiveIds(questions.map(q => q.objectiveId));
}

async function liveQuestions(evaluationId: string) {
  return db
    .select()
    .from(evaluationQuestions)
    .where(
      and(
        eq(evaluationQuestions.evaluationId, evaluationId),
        isNull(evaluationQuestions.deletedAt),
      ),
    )
    .orderBy(asc(evaluationQuestions.orderIndex));
}

/**
 * The roster behind a link, each name marked taken or free.
 *
 * Names are the one thing exposed without a token, and that is the accepted
 * cost of a shared link: anyone holding it sees the class list while the exam
 * is open. No marks, no results, no other exam.
 */
router.get("/take/:code", async (req, res) => {
  try {
    const evaluation = await evaluationByCode(req.params["code"]);
    if (!evaluation || !evaluation.classGroupId) {
      res.status(404).json({ error: "This exam link is not available", code: "link_not_found" });
      return;
    }

    const roster = await db
      .select({ id: students.id, displayName: students.displayName })
      .from(classMemberships)
      .innerJoin(students, eq(students.id, classMemberships.studentId))
      .where(eq(classMemberships.classGroupId, evaluation.classGroupId))
      .orderBy(asc(students.displayName));

    const claimed = await db
      .select({ studentId: attempts.studentId })
      .from(attempts)
      .where(eq(attempts.evaluationId, evaluation.id));
    const taken = new Set(claimed.map(a => a.studentId));

    const questions = await liveQuestions(evaluation.id);
    res.json({
      evaluation: {
        title: evaluation.title,
        titleAr: evaluation.titleAr,
        questionCount: questions.length,
        totalMarks: evaluation.totalMarks,
        timeLimitMin: evaluation.timeLimitMin,
        language: evaluation.language,
      },
      students: roster.map(s => ({ ...s, taken: taken.has(s.id) })),
    });
  } catch (err) {
    logger.error({ err }, "open student link failed");
    res.status(500).json({ error: "Failed to open this exam" });
  }
});

/**
 * Claim a name and start.
 *
 * Refuses a name someone already took rather than resuming it: with no
 * accounts there is nothing to prove the second person is the same person, and
 * quietly handing over a half-finished paper is worse than making the teacher
 * release it.
 */
router.post("/take/:code/claim", async (req, res) => {
  try {
    const evaluation = await evaluationByCode(req.params["code"]);
    if (!evaluation || !evaluation.classGroupId) {
      res.status(404).json({ error: "This exam link is not available", code: "link_not_found" });
      return;
    }

    const studentId = typeof req.body?.studentId === "string" ? req.body.studentId.trim() : "";
    if (!studentId) {
      res.status(400).json({ error: "studentId is required" });
      return;
    }

    // Must be in *this* exam's class. Without this any student id in the
    // database could be claimed through any link.
    const [member] = await db
      .select({ id: students.id, displayName: students.displayName })
      .from(classMemberships)
      .innerJoin(students, eq(students.id, classMemberships.studentId))
      .where(
        and(
          eq(classMemberships.classGroupId, evaluation.classGroupId),
          eq(classMemberships.studentId, studentId),
        ),
      )
      .limit(1);
    if (!member) {
      res.status(404).json({ error: "That student is not in this class" });
      return;
    }

    const [existing] = await db
      .select({ id: attempts.id })
      .from(attempts)
      .where(and(eq(attempts.evaluationId, evaluation.id), eq(attempts.studentId, studentId)))
      .limit(1);
    if (existing) {
      res.status(409).json({
        error: "Someone has already started with this name. Ask your teacher.",
        code: "name_taken",
      });
      return;
    }

    const questions = await liveQuestions(evaluation.id);
    if (questions.length === 0) {
      res.status(409).json({ error: "This exam has no questions" });
      return;
    }

    // Frozen at start, exactly as teacher entry does it: editing the exam
    // mid-sitting must not change what this student is graded against.
    const bands = evaluation.levelScaleId
      ? await db
          .select()
          .from(levelBands)
          .where(eq(levelBands.scaleId, evaluation.levelScaleId))
          .orderBy(asc(levelBands.sortOrder))
      : [];
    if (bands.length === 0) {
      res.status(409).json({ error: "This exam is not ready", code: "no_level_scale" });
      return;
    }

    const { token, hash } = issueAccessToken();
    let attemptId: string;
    try {
      // The id is wanted, not incidental: it seeds the per-student ordering of
      // matching questions below, and the resume route reads the same id off
      // the token — which is what keeps the two orderings identical.
      const [created] = await db.insert(attempts).values({
        evaluationId: evaluation.id,
        studentId,
        source: "student_link",
        status: "in_progress",
        startedAt: new Date(),
        accessTokenHash: hash,
        tokenExpiresAt: new Date(Date.now() + TOKEN_TTL_MS),
        questionSnapshot: questions,
        levelScaleSnapshot: { scaleId: evaluation.levelScaleId, bands },
      }).returning({ id: attempts.id });
      if (!created) throw new Error("attempt insert returned no row");
      attemptId = created.id;
    } catch (err) {
      // The check above is the fast path; this is the one that is actually
      // true. Thirty students press start at once, so two claiming the same
      // name can both pass that query before either inserts — and the loser
      // must be told the name is taken, not handed a second sitting.
      if ((err as { code?: string })?.code === "23505") {
        res.status(409).json({
          error: "Someone has already started with this name. Ask your teacher.",
          code: "name_taken",
        });
        return;
      }
      throw err;
    }

    res.status(201).json({
      token,
      student: { id: member.id, displayName: member.displayName },
      questions: questions.map(q => sanitizeQuestionForStudent(q, attemptId)),
      lessonIds: lessonIdsForPaper(questions),
    });
  } catch (err) {
    logger.error({ err }, "claim student attempt failed");
    res.status(500).json({ error: "Failed to start this exam" });
  }
});

/** Resolve the attempt a bearer token names, or nothing. */
async function attemptForToken(header: string | undefined) {
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return undefined;
  const [row] = await db
    .select()
    .from(attempts)
    .where(eq(attempts.accessTokenHash, hashAccessToken(token)))
    .limit(1);
  if (!row) return undefined;
  if (row.tokenExpiresAt && row.tokenExpiresAt.getTime() < Date.now()) return undefined;
  return row;
}

/** Resume: what this student has answered so far, and what is left. */
router.get("/take/attempt/state", async (req, res) => {
  try {
    const attempt = await attemptForToken(req.headers.authorization);
    if (!attempt) {
      res.status(401).json({ error: "This session has expired", code: "token_invalid" });
      return;
    }
    const snapshot = (attempt.questionSnapshot as EvaluationQuestion[]) ?? [];
    const saved = await db
      .select({ questionId: attemptAnswers.questionId, response: attemptAnswers.response })
      .from(attemptAnswers)
      .where(eq(attemptAnswers.attemptId, attempt.id));

    res.json({
      status: attempt.status,
      submittedAt: attempt.submittedAt,
      questions: snapshot.map(q => sanitizeQuestionForStudent(q, attempt.id)),
      answers: saved,
      // Also here, not just on claim: a student who reloads mid-exam resumes
      // through this route, and a figure panel that vanished on refresh would
      // read as the diagrams having been withdrawn.
      lessonIds: lessonIdsForPaper(snapshot),
    });
  } catch (err) {
    logger.error({ err }, "student attempt state failed");
    res.status(500).json({ error: "Failed to load this exam" });
  }
});

router.put("/take/attempt/answers/:questionId", async (req, res) => {
  try {
    const attempt = await attemptForToken(req.headers.authorization);
    if (!attempt) {
      res.status(401).json({ error: "This session has expired", code: "token_invalid" });
      return;
    }
    // Submitting is final. A late edit would change a paper after it was handed
    // in, and the teacher may already have marked it.
    if (attempt.submittedAt) {
      res.status(409).json({ error: "This exam was already submitted", code: "already_submitted" });
      return;
    }

    const questionId = req.params["questionId"] as string;
    const snapshot = (attempt.questionSnapshot as EvaluationQuestion[]) ?? [];
    if (!snapshot.some(q => q.id === questionId)) {
      res.status(404).json({ error: "Question not found in this exam" });
      return;
    }

    const response =
      req.body?.response && typeof req.body.response === "object" ? req.body.response : null;
    if (!response) {
      res.status(400).json({ error: "response is required" });
      return;
    }

    await db
      .insert(attemptAnswers)
      .values({ attemptId: attempt.id, questionId, response, isFinal: false })
      .onConflictDoUpdate({
        target: [attemptAnswers.attemptId, attemptAnswers.questionId],
        set: { response, updatedAt: new Date() },
      });

    res.json({ saved: true });
  } catch (err) {
    logger.error({ err }, "student autosave failed");
    res.status(500).json({ error: "Failed to save your answer" });
  }
});

/**
 * Hand the paper in.
 *
 * Grading itself is not repeated here — `submitAttempt` in `attempts.ts` owns
 * that, and duplicating it is how two code paths start disagreeing about the
 * same sitting. This marks the answers final, stamps `submittedAt`, and leaves
 * the attempt for the teacher; the marks appear when the teacher opens it.
 *
 * The student is told it was received and nothing more. Releasing a result is
 * the teacher's decision (`releaseResultsToStudent`), and showing correctness
 * here would leak the key to everyone still sitting the exam.
 */
router.post("/take/attempt/submit", async (req, res) => {
  try {
    const attempt = await attemptForToken(req.headers.authorization);
    if (!attempt) {
      res.status(401).json({ error: "This session has expired", code: "token_invalid" });
      return;
    }
    if (attempt.submittedAt) {
      res.json({ submitted: true, alreadySubmitted: true });
      return;
    }

    const now = new Date();
    await db
      .update(attemptAnswers)
      .set({ isFinal: true, updatedAt: now })
      .where(eq(attemptAnswers.attemptId, attempt.id));
    await db
      .update(attempts)
      .set({ status: "submitted", submittedAt: now, updatedAt: now })
      .where(eq(attempts.id, attempt.id));

    res.json({ submitted: true });
  } catch (err) {
    logger.error({ err }, "student submit failed");
    res.status(500).json({ error: "Failed to hand in this exam" });
  }
});

export default router;
