/**
 * The student side of an exam. Almost every route here is the one
 * unauthenticated write surface in the API, so everything in them is
 * deliberate.
 *
 * A teacher publishes an exam and gets a short code. One link goes on the
 * board; each student opens it, taps their own name, and answers — the link
 * is the identity, not an account. `students.ts` explains why the roster
 * itself carries no login. The one exception is `/take/:code/claim-self`,
 * which *is* authenticated: since `STUDENT_ACCOUNTS` went live, a student who
 * already has a real account and a linked roster row can skip the tap
 * entirely. Everything else below still answers to nobody but the code.
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
import { Router, type Response } from "express";
import { db } from "@workspace/db";
import {
  attemptAnswers,
  attemptResults,
  attempts,
  classMemberships,
  evaluationQuestions,
  evaluations,
  levelBands,
  rosterLinks,
  students,
} from "@workspace/db";
import type { EvaluationQuestion } from "@workspace/db";
import { and, asc, eq, isNull } from "drizzle-orm";
import { lessonIdsForObjectiveIds } from "@workspace/curriculum";
import { logger } from "../lib/logger";
import { createRateLimiter } from "../lib/rateLimit";
import {
  AiBudgetExceededError,
  AiLiveModeOffError,
  AiUserQuotaExceededError,
  assertBudgetAvailable,
  assertLiveModeEnabled,
  assertUserQuotaAvailable,
  recordAudioUsage,
} from "../lib/aiBudget";
import { MAX_DATA_URL_LENGTH, parseDataUrl } from "../lib/lessonMediaUpload";
import { authMiddleware, requireRole, type AuthenticatedRequest } from "../middlewares/auth.js";
import { newAttemptAudioKey, putObject } from "../lib/r2";
import { MAX_TAKES_PER_QUESTION, checkRecording, isRejection } from "../lib/readAloudUpload";
import {
  hashAccessToken,
  issueAccessToken,
  normalizeShareCode,
  sanitizeQuestionForStudent,
  sanitizeResultForStudent,
  studentResultReady,
} from "../modules/assessment/studentView";
import {
  acceptStudentResponse,
  examDeadline,
  isPastDeadline,
} from "../modules/assessment/studentResponse.ts";
import { gradeSubmission } from "../modules/assessment/attemptGrading.ts";
import { attemptAudioKey, deleteAttemptAudio } from "../lib/attemptAudio.ts";
import { inAudience } from "../modules/assessment/audience.ts";
import { evaluationAudience } from "../lib/evaluationAudience.ts";

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
/**
 * Two limiters, because the two halves of this file have different callers.
 *
 * `/take/:code` and the claims are the code-walking surface: keyed on the IP,
 * as before, and never on a header the caller controls — a junk bearer token
 * must not buy a fresh bucket for guessing codes.
 *
 * `/take/attempt/*` is the sitting itself. It used to share the per-IP bucket
 * with the whole classroom: thirty students typing short answers were thirty
 * streams of saves through one 240-a-minute ceiling, and when it tripped
 * every save on every phone failed and hand-in was refused. There the key
 * is the attempt token (hashed), one student, one sitting — with a loose
 * per-IP ceiling on top so spraying random tokens still costs something.
 */
const codeLimiter = createRateLimiter({ windowMs: 60_000, max: 240, name: "take" });
router.use("/take", (req, res, next) => {
  if (req.path.startsWith("/attempt")) return next();
  return codeLimiter(req, res, next);
});
router.use("/take/attempt", createRateLimiter({ windowMs: 60_000, max: 1500, name: "take-attempt-ip" }));
router.use("/take/attempt", createRateLimiter({ windowMs: 60_000, max: 240, name: "take-attempt", key: bearerOrIp }));

/**
 * How long a student's session lasts. Longer than any sitting, short enough
 * that a token left on a borrowed phone stops working the same day.
 */
const TOKEN_TTL_MS = 6 * 60 * 60 * 1000;

function bearerToken(header: string | undefined): string {
  return header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function bearerOrIp(req: { headers: { authorization?: string }; ip?: string }): string {
  const token = bearerToken(req.headers.authorization);
  return token ? hashAccessToken(token) : (req.ip ?? "unknown");
}

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
  /*
   * And an expired link, on the same reasoning and in the same silence.
   *
   * A distinct "this link has expired" would be friendlier to a student who
   * mistyped nothing — and would also tell anyone walking the code space which
   * of their guesses had once been real. The teacher is the one who can fix
   * this, by re-publishing, and they are not learning it from this endpoint.
   *
   * Null means no expiry, which is every exam published before the column
   * existed. Those are closed by a backfill, not by this line — see the PR
   * that added it. Reading null as "expired" here would have shut every live
   * exam in the country the moment this deployed.
   */
  if (row.shareCodeExpiresAt && row.shareCodeExpiresAt.getTime() <= Date.now()) {
    return undefined;
  }
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
    // A group check's link lists its group only: the names behind a link are
    // the one thing it exposes, and a group check must not expose the class.
    const audience = await evaluationAudience(evaluation.id);
    const shown = roster.filter(s => inAudience(audience, s.id));

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
      students: shown.map(s => ({ ...s, taken: taken.has(s.id) })),
    });
  } catch (err) {
    logger.error({ err }, "open student link failed");
    res.status(500).json({ error: "Failed to open this exam" });
  }
});

/**
 * Insert the attempt and answer, once a caller has already resolved which
 * roster row is being claimed and confirmed it belongs to this exam's class.
 * Shared by the anonymous tap-a-name claim and the signed-in auto-claim below
 * — the "someone already started" race, the frozen level-scale snapshot, and
 * the per-student question ordering must not exist as two copies that could
 * disagree.
 */
async function claimAttemptFor(
  res: Response,
  evaluation: NonNullable<Awaited<ReturnType<typeof evaluationByCode>>>,
  member: { id: string; displayName: string },
): Promise<void> {
  // Both claim paths (tap-a-name and signed-in self) come through here, so the
  // group rule is enforced once. Resuming an attempt already held never
  // reaches this function.
  if (!inAudience(await evaluationAudience(evaluation.id), member.id)) {
    res.status(403).json({ error: "This check is for a group in your class", code: "not_in_group" });
    return;
  }

  const [existing] = await db
    .select({ id: attempts.id })
    .from(attempts)
    .where(and(eq(attempts.evaluationId, evaluation.id), eq(attempts.studentId, member.id)))
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
  const startedAt = new Date();
  let attemptId: string;
  try {
    // The id is wanted, not incidental: it seeds the per-student ordering of
    // matching questions below, and the resume route reads the same id off
    // the token — which is what keeps the two orderings identical.
    const [created] = await db.insert(attempts).values({
      evaluationId: evaluation.id,
      studentId: member.id,
      source: "student_link",
      status: "in_progress",
      startedAt,
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
    timeLimitMin: evaluation.timeLimitMin,
    deadlineAt: examDeadline(startedAt, evaluation.timeLimitMin, 0)?.toISOString() ?? null,
  });
}

/**
 * Hand a signed-in student back the sitting they already hold.
 *
 * The anonymous claim refuses a taken name because nothing proves the second
 * tap is the same child. A signed-in account with a `self` roster link *is*
 * that proof, so a reload, a second device, or a phone that died mid-paper
 * resumes instead of landing on «بدأ أحدهم بهذا الاسم» with no way through —
 * which used to need the teacher to delete the attempt, answers and all.
 *
 * Only a sitting the student link started is resumed. A paper the teacher
 * typed in on their behalf (`teacher_entry`) is not theirs to continue, and
 * answers exactly as before: the name is taken.
 */
async function resumeAttemptFor(
  res: Response,
  evaluation: NonNullable<Awaited<ReturnType<typeof evaluationByCode>>>,
  member: { id: string; displayName: string },
): Promise<boolean> {
  const [existing] = await db
    .select()
    .from(attempts)
    .where(and(eq(attempts.evaluationId, evaluation.id), eq(attempts.studentId, member.id)))
    .limit(1);
  if (!existing) return false;
  if (existing.source !== "student_link") {
    res.status(409).json({
      error: "Someone has already started with this name. Ask your teacher.",
      code: "name_taken",
    });
    return true;
  }

  // A fresh token every time, and the old one stops working with it: the
  // previous device may be the one that was lost.
  const { token, hash } = issueAccessToken();
  await db
    .update(attempts)
    .set({ accessTokenHash: hash, tokenExpiresAt: new Date(Date.now() + TOKEN_TTL_MS), updatedAt: new Date() })
    .where(eq(attempts.id, existing.id));

  const snapshot = (existing.questionSnapshot as EvaluationQuestion[]) ?? [];
  res.status(200).json({
    token,
    resumed: true,
    student: { id: member.id, displayName: member.displayName },
    questions: snapshot.map(q => sanitizeQuestionForStudent(q, existing.id)),
    lessonIds: lessonIdsForPaper(snapshot),
    timeLimitMin: evaluation.timeLimitMin,
    deadlineAt: examDeadline(existing.startedAt, evaluation.timeLimitMin, 0)?.toISOString() ?? null,
  });
  return true;
}

/**
 * Claim a name and start.
 *
 * Refuses a name someone already took rather than resuming it: with no
 * accounts there is nothing to prove the second person is the same person, and
 * quietly handing over a half-finished paper is worse than making the teacher
 * release it. A signed-in student with a linked roster row skips this
 * entirely — see `/take/:code/claim-self` below.
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

    await claimAttemptFor(res, evaluation, member);
  } catch (err) {
    logger.error({ err }, "claim student attempt failed");
    res.status(500).json({ error: "Failed to start this exam" });
  }
});

/**
 * The identity model above is a trade this file's header is explicit about:
 * one link, tapped names, no accounts to check them against. Since
 * `STUDENT_ACCOUNTS` went live (2026-09-07) a student CAN have a real,
 * signed-in account — and when they do, this skips the tap entirely rather
 * than asking them to pick their own name off a list.
 *
 * `authMiddleware`/`requireRole` are mounted on this one route only, not on
 * `/take` as a whole — the file's other endpoints stay genuinely
 * unauthenticated, which is the property `mountOrder.test.ts` exists to
 * guard. A parent's `guardian`-relation link is deliberately not matched
 * here: a parent is never the one sitting the exam.
 *
 * Zero or more than one match answers exactly like "not eligible" (404) —
 * never a distinct status. A student account can hold `self` links across
 * several teachers/classes (see `rosterLinks`), so more than one hit here
 * means this exam's class isn't uniquely resolvable from this account, not
 * that something is wrong; the caller falls back to the ordinary picker
 * either way, silently.
 */
router.post(
  "/take/:code/claim-self",
  authMiddleware,
  requireRole("student"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const evaluation = await evaluationByCode(req.params["code"]);
      if (!evaluation || !evaluation.classGroupId) {
        res.status(404).json({ error: "This exam link is not available", code: "link_not_found" });
        return;
      }

      const matches = await db
        .select({ id: students.id, displayName: students.displayName })
        .from(rosterLinks)
        .innerJoin(students, eq(students.id, rosterLinks.studentId))
        .innerJoin(classMemberships, eq(classMemberships.studentId, students.id))
        .where(
          and(
            eq(rosterLinks.userId, req.user!.id),
            eq(rosterLinks.relation, "self"),
            eq(classMemberships.classGroupId, evaluation.classGroupId),
          ),
        )
        .limit(2);

      if (matches.length !== 1) {
        res.status(404).json({ error: "No linked roster entry for this class", code: "no_self_link" });
        return;
      }

      if (await resumeAttemptFor(res, evaluation, matches[0]!)) return;
      await claimAttemptFor(res, evaluation, matches[0]!);
    } catch (err) {
      logger.error({ err }, "self claim student attempt failed");
      res.status(500).json({ error: "Failed to start this exam" });
    }
  },
);

/** Resolve the attempt a bearer token names, or nothing. */
async function attemptForToken(header: string | undefined) {
  const token = bearerToken(header);
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

/**
 * Whether this sitting may still take an answer.
 *
 * Two things end it before the token does: the teacher closing the exam, and
 * the clock. `timeLimitMin` was shown to the teacher at publish time and
 * enforced nowhere, so a twenty-minute quiz took answers for the six hours
 * the token lasts; a closed exam (which could not be closed at all until
 * `POST /evaluations/:id/close` existed) kept taking them until the share
 * code expired a week later. Handing in stays allowed after both — what the
 * student wrote in time is theirs to submit — only new answers are refused.
 */
async function writeGate(attempt: { evaluationId: string; startedAt: Date | null }) {
  const [evaluation] = await db
    .select({ status: evaluations.status, timeLimitMin: evaluations.timeLimitMin })
    .from(evaluations)
    .where(eq(evaluations.id, attempt.evaluationId))
    .limit(1);
  // Refusal is measured with the grace period; the deadline the student is
  // shown is the real one, so their clock reaches zero when the time is up.
  const deadline = examDeadline(attempt.startedAt, evaluation?.timeLimitMin ?? null);
  return {
    timeLimitMin: evaluation?.timeLimitMin ?? null,
    deadlineAt: examDeadline(attempt.startedAt, evaluation?.timeLimitMin ?? null, 0)?.toISOString() ?? null,
    refusal:
      evaluation?.status === "closed"
        ? { status: 409, code: "exam_closed", error: "This exam has been closed" }
        : isPastDeadline(deadline)
          ? { status: 409, code: "time_up", error: "Time is up for this exam" }
          : null,
  };
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
    const gate = await writeGate(attempt);
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
      timeLimitMin: gate.timeLimitMin,
      deadlineAt: gate.deadlineAt,
      // The client's countdown runs on the device clock; a phone set a few
      // minutes fast reached zero early and force-handed the paper in,
      // irrevocably, while this server's deadline had not passed. With the
      // server's own time beside the deadline the client can measure its
      // offset once and count down in server time.
      serverNow: new Date().toISOString(),
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
    const question = snapshot.find(q => q.id === questionId);
    if (!question) {
      res.status(404).json({ error: "Question not found in this exam" });
      return;
    }

    // Per type, never pass-through — see `studentResponse.ts` for the two
    // things pass-through let a client do to a read-aloud answer.
    const accepted = acceptStudentResponse(question.type, req.body?.response);
    if (!accepted.ok) {
      res.status(accepted.status).json({ error: accepted.error, code: accepted.code });
      return;
    }
    const response = accepted.response;

    const gate = await writeGate(attempt);
    if (gate.refusal) {
      res.status(gate.refusal.status).json({ error: gate.refusal.error, code: gate.refusal.code });
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
 * A read-aloud recording: store it, transcribe it, keep both on the answer.
 *
 * This is the only route in the API that spends money on behalf of someone who
 * has no account. The identity is a shared exam link, which a student can
 * forward to anyone, so every ceiling below is doing real work rather than
 * being defensive for its own sake. The `/take` limiter above was sized for
 * thirty students clicking through a paper — generous on purpose, because a
 * classroom shares one IP — and that generosity is exactly wrong for a paid
 * endpoint, hence the second, tighter limiter keyed on the attempt.
 *
 * Transcription happens here rather than at grading time so that
 * `TypeModule.grade` can stay synchronous for all nine types.
 */

/**
 * Keyed on the attempt, not the IP.
 *
 * A per-IP ceiling cannot separate one student re-recording from a whole class
 * working, so the number that would stop abuse would also stop a lesson. The
 * attempt is the right unit: it is one student, one sitting. Hashed because a
 * raw bearer token has no business in a rate-limit key, which is stored and
 * logged. Falls back to the IP when there is no token — an unauthenticated
 * caller still must not get an unlimited bucket.
 */
router.use(
  "/take/attempt/audio",
  createRateLimiter({
    windowMs: 60_000,
    max: 12,
    name: "take-audio",
    key: bearerOrIp,
  }),
);

router.post("/take/attempt/audio/:questionId", async (req, res) => {
  let uploadedKey: string | null = null;
  try {
    const attempt = await attemptForToken(req.headers.authorization);
    if (!attempt) {
      res.status(401).json({ error: "This session has expired", code: "token_invalid" });
      return;
    }
    if (attempt.submittedAt) {
      res.status(409).json({ error: "This exam was already submitted", code: "already_submitted" });
      return;
    }

    const questionId = req.params["questionId"] as string;
    const snapshot = (attempt.questionSnapshot as EvaluationQuestion[]) ?? [];
    const question = snapshot.find(q => q.id === questionId);
    if (!question) {
      res.status(404).json({ error: "Question not found in this exam" });
      return;
    }
    // Only one type has anything to do with a recording. Without this, any
    // question in any paper becomes an upload-and-transcribe endpoint.
    if (question.type !== "read_aloud") {
      res.status(400).json({ error: "This question does not take a recording", code: "not_read_aloud" });
      return;
    }
    const gate = await writeGate(attempt);
    if (gate.refusal) {
      res.status(gate.refusal.status).json({ error: gate.refusal.error, code: gate.refusal.code });
      return;
    }

    const [existing] = await db
      .select({ response: attemptAnswers.response })
      .from(attemptAnswers)
      .where(and(eq(attemptAnswers.attemptId, attempt.id), eq(attemptAnswers.questionId, questionId)))
      .limit(1);
    const previous = (existing?.response ?? {}) as Record<string, unknown>;
    const takes = typeof previous["takes"] === "number" ? previous["takes"] : 0;

    const rawAudio = typeof req.body?.audio === "string" ? req.body.audio : "";
    const parsed = rawAudio ? parseDataUrl(rawAudio) : null;
    const verdict = checkRecording({
      mime: parsed?.mime ?? null,
      durationMs: req.body?.durationMs,
      previousTakes: takes,
      dataUrlLength: rawAudio.length,
      maxDataUrlLength: MAX_DATA_URL_LENGTH,
    });
    if (isRejection(verdict)) {
      res.status(verdict.status).json({ error: verdict.error, code: verdict.code });
      return;
    }
    // `parsed` is non-null whenever the verdict accepted a mime, but the
    // compiler cannot see that through the boundary, and an assertion here
    // would be a lie if the two ever drifted apart.
    if (!parsed) {
      res.status(400).json({ error: "audio must be a base64 data URL", code: "bad_audio" });
      return;
    }

    // Called by hand: the budget guard is not middleware anywhere in this API.
    // Without these the endpoint transcribes regardless of AI_LIVE_MODE and
    // past AI_BUDGET_USD.
    assertLiveModeEnabled();
    assertBudgetAvailable();

    /*
     * Bill the spend to the teacher who owns the exam.
     *
     * The student has no account — the link is the identity — so there is no
     * user of their own to charge, and an unattributed row makes "which class
     * is costing money" unanswerable. The owning teacher is the only honest
     * answer available.
     *
     * Its own try/catch on purpose: this is a metrics attribution, and a
     * failed lookup must not fail a recording the student has already made. It
     * also leaves no teacher to check a quota against, so the global cap is
     * the only one in force for that request.
     */
    let owningTeacherId: string | null = null;
    try {
      const [owner] = await db
        .select({ teacherId: evaluations.teacherId })
        .from(evaluations)
        .where(eq(evaluations.id, attempt.evaluationId))
        .limit(1);
      owningTeacherId = owner?.teacherId ?? null;
    } catch (err) {
      logger.warn({ err }, "could not attribute read-aloud spend to a teacher");
    }
    // The owning teacher's allowance covers their students' recordings. This
    // route used to check only the global cap, so one exam could spend past
    // the teacher's AI_USER_BUDGET_USD. Checked before the upload, not after,
    // so a refused recording costs neither storage nor a transcription.
    await assertUserQuotaAvailable(owningTeacherId);

    const key = newAttemptAudioKey(verdict.extension);
    await putObject(key, parsed.buffer, parsed.mime);
    // Set once the object exists and cleared once a row points at it: if
    // anything between here and the write fails (transcription, most
    // likely), the catch below removes the file nobody will ever reference.
    uploadedKey = key;

    /*
     * Imported inside the handler, never at module scope.
     *
     * `lib/integrations-openai-ai-server` builds its OpenAI client while the
     * module is evaluating and throws without OPENAI_API_KEY. A top-level
     * import here would take the entire student exam route — every paper, not
     * just the ones with a recording — down on any deploy missing that key.
     */
    const { speechToText } = await import("@workspace/integrations-openai-ai-server/audio");
    // `speechToText` accepts webm directly. Do NOT route this through
    // `ensureCompatibleFormat`: it shells out to ffmpeg, which is not in the
    // runtime image, so every browser recording would fail on conversion.
    const transcript = await speechToText(parsed.buffer, verdict.transcribeAs);

    recordAudioUsage(verdict.durationMs / 1000, "gpt-4o-mini-transcribe", owningTeacherId);

    const response = { audioKey: key, transcript, durationMs: verdict.durationMs, takes: takes + 1 };
    await db
      .insert(attemptAnswers)
      .values({ attemptId: attempt.id, questionId, response, isFinal: false })
      .onConflictDoUpdate({
        target: [attemptAnswers.attemptId, attemptAnswers.questionId],
        set: { response, updatedAt: new Date() },
      });
    uploadedKey = null;

    // The take this one replaced is no longer referenced by anything; its
    // recording goes with it rather than sitting in R2 for good.
    const replaced = attemptAudioKey(previous);
    if (replaced && replaced !== key) {
      await deleteAttemptAudio([replaced], { attemptId: attempt.id, questionId, reason: "re-take" });
    }

    // The transcript goes back so the student can see what was heard and
    // decide whether to use a remaining take. The score does not: releasing a
    // result here would tell them their mark before the teacher has the paper.
    res.json({ saved: true, transcript, takesLeft: MAX_TAKES_PER_QUESTION - (takes + 1) });
  } catch (err) {
    if (uploadedKey) {
      await deleteAttemptAudio([uploadedKey], { reason: "upload failed before it was saved" });
    }
    if (
      err instanceof AiLiveModeOffError
      || err instanceof AiBudgetExceededError
      || err instanceof AiUserQuotaExceededError
    ) {
      logger.warn({ err: err.message }, "read-aloud transcription refused");
      res.status(503).json({ error: "Recording is unavailable right now", code: "ai_unavailable" });
      return;
    }
    logger.error({ err }, "read-aloud upload failed");
    res.status(500).json({ error: "Failed to save your recording" });
  }
});

/**
 * Hand the paper in.
 *
 * Grades it too, through the same `gradeSubmission` the teacher's submit
 * route uses — one function, so the two cannot disagree about a sitting. It
 * used to stop at stamping `submittedAt`, which left every student-link paper
 * waiting for the teacher to press «تصحيح» once per child.
 *
 * The student is told it was received and nothing more. Releasing a result is
 * the teacher's decision (`releaseResultsToStudent`), and showing correctness
 * here would leak the key to everyone still sitting the exam. If grading
 * cannot run (a snapshot with no level scale, which `claimAttemptFor` refuses
 * to create) the paper is still marked handed in rather than lost.
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

    try {
      await gradeSubmission({ ...attempt, submittedAt: now });
    } catch (err) {
      // Handed in is the fact that matters to the student; a grading failure
      // is the teacher's to see, and their own submit route re-runs it.
      logger.error({ err, attemptId: attempt.id }, "grading on student submit failed");
    }

    res.json({ submitted: true });
  } catch (err) {
    logger.error({ err }, "student submit failed");
    res.status(500).json({ error: "Failed to hand in this exam" });
  }
});

/**
 * Has the paper been marked, and may this student see it?
 *
 * `studentResultReady` is the one place that decides that, and it stays a
 * closed "not yet" either way — the response never distinguishes "the teacher
 * has not opted in" from "grading is still open", so a student cannot use this
 * endpoint to learn how far along marking is.
 */
router.get("/take/attempt/result", async (req, res) => {
  try {
    const attempt = await attemptForToken(req.headers.authorization);
    if (!attempt) {
      res.status(401).json({ error: "This session has expired", code: "token_invalid" });
      return;
    }
    if (!attempt.submittedAt) {
      res.status(409).json({ error: "This exam has not been submitted yet", code: "not_submitted" });
      return;
    }

    const [evaluation] = await db
      .select({ releaseResultsToStudent: evaluations.releaseResultsToStudent })
      .from(evaluations)
      .where(eq(evaluations.id, attempt.evaluationId))
      .limit(1);
    const [result] = await db
      .select()
      .from(attemptResults)
      .where(eq(attemptResults.attemptId, attempt.id))
      .limit(1);

    if (!studentResultReady({ released: evaluation?.releaseResultsToStudent ?? false, result })) {
      res.json({ ready: false });
      return;
    }

    res.json({ ready: true, result: sanitizeResultForStudent(result!) });
  } catch (err) {
    logger.error({ err }, "student result lookup failed");
    res.status(500).json({ error: "Failed to load your result" });
  }
});

export default router;
