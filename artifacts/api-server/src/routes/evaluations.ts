/**
 * Evaluation authoring.
 *
 * Curriculum scope is resolved server-side on every write. The client sends
 * objective ids; the server decides whether they exist and whether they belong
 * to the book being evaluated. Taking the client's word for it would make
 * "stay within the selected grade and curriculum" a request rather than a
 * constraint.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import {
  attemptResults,
  attempts,
  evaluations,
  evaluationQuestions,
  levelBands,
  levelScales,
  classGroups,
  students,
} from "@workspace/db";
import type { Difficulty, QuestionType } from "@workspace/db";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  getBookById,
  getEvaluableBookIds,
  getObjectivesForBook,
  objectivesAreWithinBook,
  resolveObjectiveIds,
} from "@workspace/curriculum";
import { authMiddleware, type AuthenticatedRequest } from "../middlewares/auth.js";
import { logger } from "../lib/logger";
import {
  bankContextFor,
  generateMockEvaluation,
  type GenerationResult,
} from "../modules/assessment/mockGenerator";
import { validateGenerated } from "../modules/assessment/validator";
import { QUESTION_TYPES } from "../modules/assessment/questionTypes";
import { COMPETENCY_KEYS, type CompetencyKey } from "../modules/assessment/competency";
import { isPaperQuestion, parsePaperRows } from "../modules/assessment/paperExam";
import { aggregateClass } from "../modules/assessment/classInsights";
import { generateShareCode } from "../modules/assessment/studentView";
import {
  GENERATION_PROMPT_VERSION,
  generateWithModel,
} from "../modules/assessment/llmGenerator";
import {
  AiBudgetExceededError,
  AiLiveModeOffError,
  AiUserQuotaExceededError,
  assertBudgetAvailable,
  assertLiveModeEnabled,
  assertUserQuotaAvailable,
  getGenerationModel,
  isAiLiveModeOn,
  recordUsage,
} from "../lib/aiBudget.ts";
import { extractJSON } from "../lib/generationShape.ts";
import { groundingForObjectives } from "../lib/grounding.ts";
import { openai } from "@workspace/integrations-openai-ai-server";
import { recommendationsFor } from "../modules/assessment/recommend";
import type { ObjectiveScore } from "../modules/assessment/scoring";

const router = Router();
// Path-scoped — see the note in roster.ts. Unscoped, this swallowed every
// request reaching it, including routes belonging to later routers.
router.use("/evaluations", authMiddleware);

const ALL_TYPES = Object.keys(QUESTION_TYPES) as QuestionType[];
const DIFFICULTIES: Difficulty[] = ["basic", "standard", "advanced"];
const MAX_QUESTIONS = 50;

const trimmed = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Owned-or-404. Never distinguish "not yours" from "not there". */
async function ownedEvaluation(id: string, teacherId: string) {
  const [row] = await db
    .select()
    .from(evaluations)
    .where(and(eq(evaluations.id, id), eq(evaluations.teacherId, teacherId)))
    .limit(1);
  return row;
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

/** Recompute the denormalized mark total after any question write. */
async function recomputeTotal(evaluationId: string): Promise<number> {
  const rows = await liveQuestions(evaluationId);
  const total = rows.reduce((sum, q) => sum + Number(q.marks), 0);
  await db
    .update(evaluations)
    .set({ totalMarks: total.toFixed(2), updatedAt: new Date() })
    .where(eq(evaluations.id, evaluationId));
  return total;
}

// ─── Evaluation CRUD ─────────────────────────────────────────────────────────

router.post("/evaluations", async (req: AuthenticatedRequest, res) => {
  try {
    const bookId = trimmed(req.body?.bookId);
    const book = bookId ? getBookById(bookId) : undefined;
    if (!book) {
      res.status(400).json({ error: "A valid bookId is required" });
      return;
    }

    const objectiveIds: string[] = Array.isArray(req.body?.objectiveIds)
      ? req.body.objectiveIds.filter((id: unknown) => typeof id === "string")
      : [];

    // An evaluation with no objectives cannot measure anything, and the whole
    // downstream chain (competencies, gaps, recommendations) keys off them.
    if (objectiveIds.length === 0) {
      res.status(400).json({ error: "Select at least one learning objective" });
      return;
    }

    const { missing } = resolveObjectiveIds(objectiveIds);
    if (missing.length > 0) {
      res.status(400).json({ error: "Unknown objective ids", missing });
      return;
    }
    if (!objectivesAreWithinBook(objectiveIds, bookId)) {
      res.status(400).json({ error: "Objectives must all belong to the selected book" });
      return;
    }

    const difficulty: Difficulty = DIFFICULTIES.includes(req.body?.difficulty)
      ? req.body.difficulty
      : "standard";

    const requestedTypes: QuestionType[] = Array.isArray(req.body?.assessmentTypes)
      ? req.body.assessmentTypes.filter((t: QuestionType) => ALL_TYPES.includes(t))
      : [];
    if (requestedTypes.length === 0) {
      res.status(400).json({ error: "Select at least one assessment type" });
      return;
    }

    const count = Number(req.body?.targetQuestionCount ?? 10);
    if (!Number.isInteger(count) || count < 1 || count > MAX_QUESTIONS) {
      res.status(400).json({ error: `Question count must be between 1 and ${MAX_QUESTIONS}` });
      return;
    }

    const [defaultScale] = await db
      .select({ id: levelScales.id })
      .from(levelScales)
      .where(and(eq(levelScales.scope, "system"), eq(levelScales.isDefault, true)))
      .limit(1);
    // Refuse here rather than storing a null scale and failing later.
    // Without this an evaluation is created happily, and the teacher only
    // finds out three screens on — at answer entry, where the attempt cannot
    // be graded against a scale that does not exist. An error belongs where
    // its cause is.
    if (!defaultScale) {
      res.status(409).json({
        error:
          "No level scale is configured. Seed the assessment configuration before creating evaluations.",
        code: "no_level_scale",
      });
      return;
    }

    const [row] = await db
      .insert(evaluations)
      .values({
        teacherId: req.user!.id,
        title: trimmed(req.body?.title),
        titleAr: trimmed(req.body?.titleAr),
        gradeId: book.gradeId,
        subjectId: book.subjectId,
        bookId,
        unitId: trimmed(req.body?.unitId) || null,
        lessonId: trimmed(req.body?.lessonId) || null,
        objectiveIds,
        difficulty,
        targetQuestionCount: count,
        assessmentTypes: requestedTypes,
        language: trimmed(req.body?.language) || "ar",
        levelScaleId: defaultScale.id,
      })
      .returning();

    res.status(201).json({ evaluation: row });
  } catch (err) {
    logger.error({ err }, "create evaluation failed");
    res.status(500).json({ error: "Failed to create evaluation" });
  }
});

router.get("/evaluations", async (req: AuthenticatedRequest, res) => {
  try {
    const classId = trimmed(req.query["classId"]);
    const rows = await db
      .select({
        id: evaluations.id,
        classGroupId: evaluations.classGroupId,
        shareCode: evaluations.shareCode,
        title: evaluations.title,
        titleAr: evaluations.titleAr,
        subjectId: evaluations.subjectId,
        bookId: evaluations.bookId,
        status: evaluations.status,
        difficulty: evaluations.difficulty,
        totalMarks: evaluations.totalMarks,
        createdAt: evaluations.createdAt,
        questionCount: sql<number>`(
          SELECT count(*)::int FROM evaluation_questions eq
          WHERE eq.evaluation_id = evaluations.id AND eq.deleted_at IS NULL
        )`,
        /**
         * How many papers are actually marked. Counted from `attempt_results`
         * rather than from attempt status, because an attempt can sit in
         * `needs_review` with real marks on it — status answers "is it
         * finished", and the teacher's question here is "how many are done".
         */
        markedCount: sql<number>`(
          SELECT count(*)::int FROM attempt_results ar
          JOIN attempts a ON a.id = ar.attempt_id
          WHERE a.evaluation_id = evaluations.id
            AND ar.total_marks > 0
        )`,
      })
      .from(evaluations)
      .where(
        and(
          eq(evaluations.teacherId, req.user!.id),
          // `?classId=` filters to one class; `?classId=none` is how the attach
          // sheet asks for exams that belong to no class yet. Without the
          // second form the sheet would have to fetch everything and filter
          // client-side, which is the shape that made "already attached
          // elsewhere" look attachable in the materials sheet.
          classId === "none"
            ? isNull(evaluations.classGroupId)
            : classId
              ? eq(evaluations.classGroupId, classId)
              : undefined,
        ),
      )
      .orderBy(asc(evaluations.createdAt));
    res.json({ evaluations: rows });
  } catch (err) {
    logger.error({ err }, "list evaluations failed");
    res.status(500).json({ error: "Failed to load evaluations" });
  }
});

router.get("/evaluations/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const row = await ownedEvaluation(req.params["id"] as string, req.user!.id);
    if (!row) {
      res.status(404).json({ error: "Evaluation not found" });
      return;
    }
    // Teacher view — answers and rubrics included. The student projection is a
    // different endpoint entirely, so the two cannot be confused.
    res.json({ evaluation: row, questions: await liveQuestions(row.id) });
  } catch (err) {
    logger.error({ err }, "get evaluation failed");
    res.status(500).json({ error: "Failed to load evaluation" });
  }
});

// ─── Generation ──────────────────────────────────────────────────────────────

/**
 * Attach this exam to a class, or detach it.
 *
 * Attaching happens here rather than at authoring time for the same reason it
 * does for materials: a teacher does not know which section a paper is for
 * while they are writing it, and putting a class picker in the authoring flow
 * would mean answering that question before it can be answered.
 *
 * `classGroupId: null` detaches. The check is `!== undefined`, not truthiness —
 * treating null as "not provided" would make attach work and detach silently
 * do nothing, which is exactly the bug `pickDefined` was extracted to prevent.
 */
router.patch("/evaluations/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const evaluation = await ownedEvaluation(req.params["id"] as string, req.user!.id);
    if (!evaluation) {
      res.status(404).json({ error: "Evaluation not found" });
      return;
    }

    const raw = req.body?.classGroupId;
    if (raw === undefined) {
      res.status(400).json({ error: "classGroupId is required" });
      return;
    }
    const classGroupId = raw === null ? null : trimmed(raw);
    if (classGroupId) {
      const [group] = await db
        .select({ id: classGroups.id })
        .from(classGroups)
        .where(and(eq(classGroups.id, classGroupId), eq(classGroups.teacherId, req.user!.id)))
        .limit(1);
      if (!group) {
        res.status(404).json({ error: "Class not found" });
        return;
      }
    }

    const [updated] = await db
      .update(evaluations)
      .set({ classGroupId: classGroupId || null, updatedAt: new Date() })
      .where(eq(evaluations.id, evaluation.id))
      .returning();

    res.json({ evaluation: updated });
  } catch (err) {
    logger.error({ err }, "attach evaluation to class failed");
    res.status(500).json({ error: "Failed to update the evaluation" });
  }
});

router.post("/evaluations/:id/generate", async (req: AuthenticatedRequest, res) => {
  try {
    const evaluation = await ownedEvaluation(req.params["id"] as string, req.user!.id);
    if (!evaluation) {
      res.status(404).json({ error: "Evaluation not found" });
      return;
    }
    if (evaluation.status !== "draft") {
      res.status(409).json({ error: "Only a draft can be generated into" });
      return;
    }

    const { found: objectives, missing } = resolveObjectiveIds(evaluation.objectiveIds);
    if (objectives.length === 0) {
      res.status(400).json({
        error: "This evaluation's objectives no longer exist in the curriculum",
        missing,
      });
      return;
    }

    /**
     * Which generator wrote this paper, and the one rule about it.
     *
     * With live mode off, the mock runs — four Arabic templates that cannot
     * produce a single self-marking question type. With it on, a model writes
     * them properly.
     *
     * **A failed model call does not quietly become the mock.** This repo has
     * been bitten once by mock output that looked identical to real output;
     * four template questions appearing where a teacher asked for a real paper
     * is the same bug wearing a different hat. The failure is reported and the
     * teacher decides.
     */
    const live = isAiLiveModeOn();
    let result: GenerationResult;
    let generator: "mock" | "llm" = "mock";
    let modelId: string | null = null;
    const generationNotes: string[] = [];

    // The exact request handed to the generator, stored on the evaluation —
    // the schema has promised this since Phase 3 and nothing ever wrote it.
    const generationParams: Record<string, unknown> = {
      objectiveIds: evaluation.objectiveIds,
      assessmentTypes: evaluation.assessmentTypes,
      count: evaluation.targetQuestionCount,
      difficulty: evaluation.difficulty,
      language: evaluation.language,
    };

    if (live) {
      assertLiveModeEnabled();
      assertBudgetAvailable();
      await assertUserQuotaAvailable(req.user!.id);

      // The book, where there is one. Exam questions written from an
      // objective's title alone are the thing this whole path exists to stop
      // being the ceiling; `null` when nothing has been read for these units,
      // and the prompt then omits the section entirely.
      const grounding = groundingForObjectives(objectives, evaluation.language !== "en");
      if (grounding) {
        generationNotes.push(
          `Grounded on ${grounding.sources.map(s => `${s.titleAr} p${s.page}`).join(", ")}.`,
        );
      } else {
        // Say so, loudly. A paper written without the book reading exactly
        // like one written from it is how ungrounded content slips through.
        generationNotes.push(
          "No official-book passages are extracted for these objectives' units — "
            + "the model wrote from the objectives alone. Review against the book "
            + "before publishing.",
        );
      }

      const llm = await generateWithModel(
        {
          objectives,
          assessmentTypes: evaluation.assessmentTypes,
          count: evaluation.targetQuestionCount,
          difficulty: evaluation.difficulty,
          language: evaluation.language,
          bookExcerpts: grounding?.block,
        },
        async prompt => {
          const model = getGenerationModel();
          const completion = await openai.chat.completions.create({
            model,
            // Room for a full paper of questions with options and rubrics. A
            // truncated response parses to something plausible, which is worse
            // than an error.
            max_completion_tokens: 8000,
            messages: [
              { role: "system", content: prompt.system },
              { role: "user", content: prompt.user },
            ],
          });
          recordUsage(completion.usage, model, {
            kind: "quiz",
            promptVersion: GENERATION_PROMPT_VERSION,
            userId: req.user!.id,
          });
          return {
            parsed: extractJSON(completion.choices[0]?.message?.content ?? "{}"),
            model,
          };
        },
      );

      generator = "llm";
      modelId = llm.model;
      generationParams["promptVersion"] = GENERATION_PROMPT_VERSION;
      generationParams["grounded"] = Boolean(grounding);
      generationParams["groundingSources"] = grounding
        ? grounding.sources.map(s => ({ sourceId: s.sourceId, page: s.page }))
        : [];
      generationNotes.push(...llm.notes);
      result = {
        questions: llm.questions,
        // The model was asked for every requested type, so nothing is
        // "unavailable" the way it is for the mock — a type that came back
        // wrong is a discard, and llm.notes already says so.
        unavailableTypes: [],
        shortfall: Math.max(0, evaluation.targetQuestionCount - llm.questions.length),
        notes: [],
        // Still worth carrying: the bank pointer answers "where else could I
        // look", which is useful whether or not the generator declined
        // anything. It just is not a consolation prize here.
        bankContext: bankContextFor(objectives),
      };
    } else {
      result = generateMockEvaluation({
        objectives,
        assessmentTypes: evaluation.assessmentTypes,
        count: evaluation.targetQuestionCount,
        difficulty: evaluation.difficulty,
      });
      // The seed the template variation ran on — with it, this exact paper
      // can be regenerated; without it, "reproducible" would be a lie.
      generationParams["seed"] = result.seed;
    }

    const validation = validateGenerated(result.questions, {
      allowedObjectiveIds: evaluation.objectiveIds,
      allowedTypes: evaluation.assessmentTypes,
    });

    // Replace rather than append: generating twice should not silently double
    // the length of the evaluation.
    await db
      .update(evaluationQuestions)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(evaluationQuestions.evaluationId, evaluation.id),
          isNull(evaluationQuestions.deletedAt),
        ),
      );

    if (validation.accepted.length > 0) {
      await db.insert(evaluationQuestions).values(
        validation.accepted.map((q, i) => ({
          evaluationId: evaluation.id,
          orderIndex: i,
          type: q.type,
          body: q.body,
          expectedAnswer: q.expectedAnswer,
          rubric: q.rubric,
          objectiveId: q.objectiveId,
          competencyKey: q.competencyKey,
          skill: q.skill,
          difficulty: q.difficulty,
          marks: q.marks.toFixed(2),
          gradingMode: q.gradingMode as never,
          source: "ai" as const,
          aiMetadata: q.aiMetadata,
        })),
      );
    }

    // Recorded on the evaluation, not just in each question's aiMetadata, so
    // "was this paper written by a model or by four templates?" is answerable
    // without opening a question.
    await db
      .update(evaluations)
      .set({ generator, modelId, generationParams, updatedAt: new Date() })
      .where(eq(evaluations.id, evaluation.id));

    const totalMarks = await recomputeTotal(evaluation.id);

    res.json({
      questions: await liveQuestions(evaluation.id),
      totalMarks,
      generator,
      modelId,
      requested: evaluation.targetQuestionCount,
      produced: validation.accepted.length,
      // Everything the generator declined or the validator dropped, stated
      // plainly. A teacher seeing 12 of 15 should know why, not wonder.
      unavailableTypes: result.unavailableTypes,
      // What the library holds for these units. Pairs with unavailableTypes:
      // the types we declined, and where real items for them would come from.
      bankContext: result.bankContext,
      rejected: validation.rejected,
      warnings: [...result.notes, ...generationNotes, ...validation.warnings],
    });
  } catch (err) {
    // Four different things a teacher can do something about, and they are not
    // the same thing. "Generation failed" for all of them is the message that
    // makes a spend cap look like an outage and an outage look like a bug.
    if (err instanceof AiUserQuotaExceededError) {
      res.status(429).json({ error: err.message, code: "user_quota_exceeded" });
      return;
    }
    if (err instanceof AiBudgetExceededError) {
      res.status(429).json({ error: err.message, code: "budget_exceeded" });
      return;
    }
    if (err instanceof AiLiveModeOffError) {
      res.status(503).json({ error: err.message, code: "live_mode_off" });
      return;
    }
    logger.error({ err }, "generate evaluation failed");
    res.status(502).json({
      // Says which half failed. Nothing was written — the questions are only
      // replaced after a successful generation — so retrying is safe, and
      // saying so stops a teacher wondering whether they now have half a paper.
      error:
        "The question generator did not respond. Nothing was changed — try again, "
        + "or switch this evaluation to a paper exam.",
      code: "generator_unavailable",
    });
  }
});

/**
 * Replace this evaluation's questions with a paper-exam grid.
 *
 * For an exam the teacher set themselves: no question text, because the paper
 * has it — just marks, objective and competency per question. That is the
 * minimum the app needs to mark the paper, score it, and afterwards say which
 * objectives the class is weak on.
 *
 * Questions land as `open_ended` with an empty body and `gradingMode: 'manual'`.
 * The type is the honest one available: nothing here can be marked
 * automatically, so the deterministic pass leaves every question alone and the
 * teacher marks each by hand. An empty `body` is also what tells the answer
 * screen there is no prompt to show and no student answer to transcribe.
 *
 * Replace, not append — same as generate. Sending the grid twice must not
 * double the length of the paper.
 */
router.put("/evaluations/:id/questions/paper", async (req: AuthenticatedRequest, res) => {
  try {
    const evaluation = await ownedEvaluation(req.params["id"] as string, req.user!.id);
    if (!evaluation) {
      res.status(404).json({ error: "Evaluation not found" });
      return;
    }
    if (evaluation.status !== "draft") {
      res.status(409).json({ error: "Only a draft can be edited" });
      return;
    }

    const parsed = parsePaperRows(req.body?.questions, {
      allowedObjectiveIds: evaluation.objectiveIds,
      maxQuestions: MAX_QUESTIONS,
    });
    if (!parsed.ok) {
      res.status(400).json({
        error: parsed.error,
        code: "invalid_paper_grid",
        ...(parsed.index === undefined ? {} : { questionIndex: parsed.index }),
      });
      return;
    }

    await db
      .update(evaluationQuestions)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(evaluationQuestions.evaluationId, evaluation.id),
          isNull(evaluationQuestions.deletedAt),
        ),
      );

    await db.insert(evaluationQuestions).values(
      parsed.rows.map((q, i) => ({
        evaluationId: evaluation.id,
        orderIndex: i,
        type: "open_ended" as QuestionType,
        body: {},
        expectedAnswer: {},
        objectiveId: q.objectiveId,
        competencyKey: q.competencyKey,
        difficulty: q.difficulty,
        marks: q.marks.toFixed(2),
        gradingMode: "manual" as const,
        source: "teacher" as const,
      })),
    );

    const totalMarks = await recomputeTotal(evaluation.id);
    res.json({ questions: await liveQuestions(evaluation.id), totalMarks });
  } catch (err) {
    logger.error({ err }, "save paper questions failed");
    res.status(500).json({ error: "Failed to save the paper" });
  }
});

// ─── Question editing ────────────────────────────────────────────────────────

router.patch(
  "/evaluations/:id/questions/:qid",
  async (req: AuthenticatedRequest, res) => {
    try {
      const evaluation = await ownedEvaluation(req.params["id"] as string, req.user!.id);
      if (!evaluation) {
        res.status(404).json({ error: "Evaluation not found" });
        return;
      }

      const [existing] = await db
        .select()
        .from(evaluationQuestions)
        .where(
          and(
            eq(evaluationQuestions.id, req.params["qid"] as string),
            eq(evaluationQuestions.evaluationId, evaluation.id),
            isNull(evaluationQuestions.deletedAt),
          ),
        )
        .limit(1);

      if (!existing) {
        res.status(404).json({ error: "Question not found" });
        return;
      }

      const patch: Record<string, unknown> = { updatedAt: new Date() };

      if (req.body?.objectiveId !== undefined) {
        const objectiveId = trimmed(req.body.objectiveId);
        // A teacher may retarget a question, but only within the objectives the
        // evaluation was scoped to — otherwise the results claim to measure
        // something the evaluation was never about.
        if (!evaluation.objectiveIds.includes(objectiveId)) {
          res.status(400).json({ error: "Objective is not in this evaluation's scope" });
          return;
        }
        patch["objectiveId"] = objectiveId;
      }

      if (req.body?.competencyKey !== undefined) {
        const key = trimmed(req.body.competencyKey) as CompetencyKey;
        if (!COMPETENCY_KEYS.includes(key)) {
          res.status(400).json({ error: "Unknown competency" });
          return;
        }
        patch["competencyKey"] = key;
      }

      if (req.body?.marks !== undefined) {
        const marks = Number(req.body.marks);
        if (!(marks > 0)) {
          res.status(400).json({ error: "Marks must be greater than zero" });
          return;
        }
        patch["marks"] = marks.toFixed(2);
      }

      if (req.body?.difficulty !== undefined) {
        if (!DIFFICULTIES.includes(req.body.difficulty)) {
          res.status(400).json({ error: "Unknown difficulty" });
          return;
        }
        patch["difficulty"] = req.body.difficulty;
      }

      // Body / answer / rubric edits are re-validated against the type, so a
      // teacher cannot save a question that would break in front of a student.
      const nextBody = req.body?.body ?? existing.body;
      const nextAnswer = req.body?.expectedAnswer ?? existing.expectedAnswer;
      const nextRubric = req.body?.rubric !== undefined ? req.body.rubric : existing.rubric;

      if (
        req.body?.body !== undefined ||
        req.body?.expectedAnswer !== undefined ||
        req.body?.rubric !== undefined
      ) {
        const problems = QUESTION_TYPES[existing.type].validate({
          type: existing.type,
          body: nextBody,
          expectedAnswer: nextAnswer,
          rubric: nextRubric,
        });
        if (problems.length > 0) {
          res.status(400).json({ error: problems.join("; ") });
          return;
        }
        patch["body"] = nextBody;
        patch["expectedAnswer"] = nextAnswer;
        patch["rubric"] = nextRubric;
      }

      // Mark the provenance honestly: this is no longer purely AI output.
      if (existing.source === "ai") patch["source"] = "ai_edited";

      const [updated] = await db
        .update(evaluationQuestions)
        .set(patch)
        .where(eq(evaluationQuestions.id, existing.id))
        .returning();

      const totalMarks = await recomputeTotal(evaluation.id);
      res.json({ question: updated, totalMarks });
    } catch (err) {
      logger.error({ err }, "update question failed");
      res.status(500).json({ error: "Failed to update question" });
    }
  },
);

router.delete(
  "/evaluations/:id/questions/:qid",
  async (req: AuthenticatedRequest, res) => {
    try {
      const evaluation = await ownedEvaluation(req.params["id"] as string, req.user!.id);
      if (!evaluation) {
        res.status(404).json({ error: "Evaluation not found" });
        return;
      }
      const [removed] = await db
        .update(evaluationQuestions)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(evaluationQuestions.id, req.params["qid"] as string),
            eq(evaluationQuestions.evaluationId, evaluation.id),
            isNull(evaluationQuestions.deletedAt),
          ),
        )
        .returning({ id: evaluationQuestions.id });

      if (!removed) {
        res.status(404).json({ error: "Question not found" });
        return;
      }
      res.json({ removed: removed.id, totalMarks: await recomputeTotal(evaluation.id) });
    } catch (err) {
      logger.error({ err }, "delete question failed");
      res.status(500).json({ error: "Failed to delete question" });
    }
  },
);

// ─── Coverage & publish ──────────────────────────────────────────────────────

/**
 * What this evaluation actually measures, before anyone commits to it.
 *
 * Marks per competency and per objective, plus the blocking problems. The
 * competency numbers are marks-weighted rather than counts, because that is how
 * the level will be computed — a coverage meter that disagrees with the result
 * is worse than none.
 */
router.get("/evaluations/:id/coverage", async (req: AuthenticatedRequest, res) => {
  try {
    const evaluation = await ownedEvaluation(req.params["id"] as string, req.user!.id);
    if (!evaluation) {
      res.status(404).json({ error: "Evaluation not found" });
      return;
    }
    const questions = await liveQuestions(evaluation.id);
    const total = questions.reduce((s, q) => s + Number(q.marks), 0);

    const byCompetency = Object.fromEntries(
      COMPETENCY_KEYS.map(k => {
        const mine = questions.filter(q => q.competencyKey === k);
        const marks = mine.reduce((s, q) => s + Number(q.marks), 0);
        return [
          k,
          {
            questionCount: mine.length,
            marks,
            share: total > 0 ? marks / total : 0,
            // Mirrors the scoring rule, so the meter warns about exactly what
            // the dashboard will later refuse to report.
            sufficient: mine.length >= 2 && total > 0 && marks / total >= 0.1,
          },
        ];
      }),
    );

    const byObjective = evaluation.objectiveIds.map(id => {
      const mine = questions.filter(q => q.objectiveId === id);
      return {
        objectiveId: id,
        questionCount: mine.length,
        marks: mine.reduce((s, q) => s + Number(q.marks), 0),
      };
    });

    const blockers: string[] = [];
    if (questions.length === 0) blockers.push("This evaluation has no questions");
    if (total <= 0) blockers.push("Total marks are zero");

    const uncovered = byObjective.filter(o => o.questionCount === 0);
    const warnings = uncovered.length
      ? [`${uncovered.length} objective(s) have no questions`]
      : [];

    res.json({ totalMarks: total, byCompetency, byObjective, blockers, warnings });
  } catch (err) {
    logger.error({ err }, "coverage failed");
    res.status(500).json({ error: "Failed to compute coverage" });
  }
});

router.post("/evaluations/:id/publish", async (req: AuthenticatedRequest, res) => {
  try {
    const evaluation = await ownedEvaluation(req.params["id"] as string, req.user!.id);
    if (!evaluation) {
      res.status(404).json({ error: "Evaluation not found" });
      return;
    }
    const questions = await liveQuestions(evaluation.id);
    const total = questions.reduce((s, q) => s + Number(q.marks), 0);

    // Publishing is the point of no return for in-flight attempts, so the
    // blocking checks live here rather than being advisory.
    const blockers: string[] = [];
    if (questions.length === 0) blockers.push("Add at least one question before publishing");
    if (total <= 0) blockers.push("Total marks must be greater than zero");
    for (const q of questions) {
      // A paper exam's questions are on paper. There is no body to validate,
      // and demanding one would make a paper exam unpublishable.
      if (isPaperQuestion(q)) continue;
      const problems = QUESTION_TYPES[q.type].validate({
        type: q.type,
        body: q.body,
        expectedAnswer: q.expectedAnswer,
        rubric: q.rubric,
      });
      if (problems.length > 0) blockers.push(`Question ${q.orderIndex + 1}: ${problems[0]}`);
    }

    if (blockers.length > 0) {
      res.status(400).json({ error: "Evaluation is not ready to publish", blockers });
      return;
    }

    // The share code is issued once and kept. Re-publishing after an edit must
    // not invalidate a link a teacher has already written on the board.
    //
    // The retry is for the unique index, not for luck: 31^6 codes make a
    // collision vanishingly rare, and silently failing a publish because of one
    // would be a bug nobody could reproduce.
    let updated;
    for (let attempt = 0; attempt < 5 && !updated; attempt++) {
      try {
        [updated] = await db
          .update(evaluations)
          .set({
            status: "published",
            publishedAt: new Date(),
            updatedAt: new Date(),
            totalMarks: total.toFixed(2),
            shareCode: evaluation.shareCode ?? generateShareCode(),
          })
          .where(eq(evaluations.id, evaluation.id))
          .returning();
      } catch (err) {
        const code = (err as { code?: string })?.code;
        if (code !== "23505" || evaluation.shareCode) throw err;
        logger.warn({ evaluationId: evaluation.id }, "share code collision, retrying");
      }
    }
    if (!updated) {
      res.status(500).json({ error: "Failed to publish" });
      return;
    }

    res.json({ evaluation: updated });
  } catch (err) {
    logger.error({ err }, "publish failed");
    res.status(500).json({ error: "Failed to publish" });
  }
});

// ─── Attempts (teacher answer entry) ────────────────────────────────────────
// Creation lives here, under /evaluations, because starting an attempt needs
// the evaluation's live questions and level scale. Everything after creation
// (answers, submit) is keyed by the attempt's own id and lives in attempts.ts.

async function ownedStudent(id: string, teacherId: string) {
  const [row] = await db
    .select()
    .from(students)
    .where(and(eq(students.id, id), eq(students.teacherId, teacherId)))
    .limit(1);
  return row;
}

router.get("/evaluations/:id/attempts", async (req: AuthenticatedRequest, res) => {
  try {
    const evaluation = await ownedEvaluation(req.params["id"] as string, req.user!.id);
    if (!evaluation) {
      res.status(404).json({ error: "Evaluation not found" });
      return;
    }

    const rows = await db
      .select({
        id: attempts.id,
        studentId: attempts.studentId,
        studentName: students.displayName,
        status: attempts.status,
        startedAt: attempts.startedAt,
        submittedAt: attempts.submittedAt,
        gradedAt: attempts.gradedAt,
      })
      .from(attempts)
      .innerJoin(students, eq(students.id, attempts.studentId))
      .where(eq(attempts.evaluationId, evaluation.id))
      .orderBy(asc(students.displayName));

    const attemptIds = rows.map(r => r.id);
    const results = attemptIds.length
      ? await db.select().from(attemptResults).where(inArray(attemptResults.attemptId, attemptIds))
      : [];
    const byAttempt = new Map(results.map(r => [r.attemptId, r]));

    res.json({ attempts: rows.map(r => ({ ...r, result: byAttempt.get(r.id) ?? null })) });
  } catch (err) {
    logger.error({ err }, "list attempts failed");
    res.status(500).json({ error: "Failed to load attempts" });
  }
});

/**
 * Find-or-create: re-opening answer entry for a student who already has an
 * attempt returns it rather than starting a second one. Teacher entry has no
 * "resume where I left off" UI of its own — the attempt itself is that state.
 */
router.post("/evaluations/:id/attempts", async (req: AuthenticatedRequest, res) => {
  try {
    const evaluation = await ownedEvaluation(req.params["id"] as string, req.user!.id);
    if (!evaluation) {
      res.status(404).json({ error: "Evaluation not found" });
      return;
    }
    if (evaluation.status !== "published") {
      res.status(409).json({ error: "Publish this evaluation before entering answers" });
      return;
    }

    const studentId = trimmed(req.body?.studentId);
    if (!studentId) {
      res.status(400).json({ error: "studentId is required" });
      return;
    }
    const student = await ownedStudent(studentId, req.user!.id);
    if (!student) {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    const [existing] = await db
      .select()
      .from(attempts)
      .where(
        and(
          eq(attempts.evaluationId, evaluation.id),
          eq(attempts.studentId, studentId),
          eq(attempts.source, "teacher_entry"),
        ),
      )
      .limit(1);
    if (existing) {
      res.json({ attempt: existing, created: false });
      return;
    }

    const questions = await liveQuestions(evaluation.id);
    if (questions.length === 0) {
      res.status(409).json({ error: "This evaluation has no questions" });
      return;
    }

    // Frozen at start, per the plan: a later edit to the evaluation or the
    // scale must not retroactively change what this attempt is graded against.
    const bands = evaluation.levelScaleId
      ? await db
          .select()
          .from(levelBands)
          .where(eq(levelBands.scaleId, evaluation.levelScaleId))
          .orderBy(asc(levelBands.sortOrder))
      : [];
    if (bands.length === 0) {
      res.status(409).json({ error: "No level scale is configured for this evaluation" });
      return;
    }

    const [row] = await db
      .insert(attempts)
      .values({
        evaluationId: evaluation.id,
        studentId,
        source: "teacher_entry",
        enteredBy: req.user!.id,
        status: "in_progress",
        startedAt: new Date(),
        questionSnapshot: questions,
        levelScaleSnapshot: { scaleId: evaluation.levelScaleId, bands },
      })
      .returning();

    res.status(201).json({ attempt: row, created: true });
  } catch (err) {
    logger.error({ err }, "create attempt failed");
    res.status(500).json({ error: "Failed to start attempt" });
  }
});

/**
 * Books a teacher can actually build an evaluation from.
 *
 * Math S1 units 2–4 have lessons but no objectives, so offering them would put
 * a teacher in front of a generator with no curriculum behind it. Better to say
 * the unit is not ready than to invent questions for it.
 */
/**
 * What the class as a whole missed, and what to do about it.
 *
 * The per-student view answers "how did Sara do". After marking thirty papers
 * a teacher has one question, not thirty: what do I go back over tomorrow.
 *
 * Only marked attempts count. An attempt nobody has entered marks for carries
 * an empty objective breakdown, and letting those into the aggregate would
 * quietly drag every class percentage toward zero as the roster grows —
 * "the class is at 31%" would mean "you have not finished marking".
 */
router.get("/evaluations/:id/insights", async (req: AuthenticatedRequest, res) => {
  try {
    const evaluation = await ownedEvaluation(req.params["id"] as string, req.user!.id);
    if (!evaluation) {
      res.status(404).json({ error: "Evaluation not found" });
      return;
    }

    const rows = await db
      .select({ objectiveScores: attemptResults.objectiveScores })
      .from(attemptResults)
      .innerJoin(attempts, eq(attempts.id, attemptResults.attemptId))
      .where(eq(attempts.evaluationId, evaluation.id));

    const marked = rows
      .map(r => ({ objectiveScores: (r.objectiveScores as ObjectiveScore[]) ?? [] }))
      .filter(a => a.objectiveScores.length > 0);

    const insights = aggregateClass(marked);

    const { found } = resolveObjectiveIds(insights.objectiveScores.map(o => o.objectiveId));
    const byId = new Map(found.map(o => [o.id, o]));
    const nextSteps = recommendationsFor(insights, id => {
      const objective = byId.get(id);
      if (!objective) return undefined;
      return {
        title: objective.description ?? "",
        titleAr: objective.descriptionAr || objective.description || "",
      };
    });

    res.json({
      insights: {
        ...insights,
        objectiveScores: insights.objectiveScores.map(o => ({
          ...o,
          title: byId.get(o.objectiveId)?.description ?? "",
          titleAr:
            byId.get(o.objectiveId)?.descriptionAr ||
            byId.get(o.objectiveId)?.description ||
            "",
        })),
      },
      // Computed per request, not stored: `recommendations` is keyed by
      // attempt, and a class has no attempt to hang these off. They are also
      // cheap and change the moment one more paper is marked.
      recommendations: nextSteps,
      scope: {
        gradeId: evaluation.gradeId,
        subjectId: evaluation.subjectId,
        bookId: evaluation.bookId,
      },
    });
  } catch (err) {
    logger.error({ err }, "class insights failed");
    res.status(500).json({ error: "Failed to load class insights" });
  }
});

router.get("/evaluations/meta/evaluable", async (_req: AuthenticatedRequest, res) => {
  try {
    // Every book with at least one objective, from the curriculum catalog —
    // a hand-kept list here silently dropped chemistry S2 when it was added.
    const books = getEvaluableBookIds()
      .map(id => ({ book: getBookById(id), objectives: getObjectivesForBook(id) }))
      .filter(b => b.book)
      .map(b => ({
        bookId: b.book!.id,
        titleAr: b.book!.titleAr,
        objectiveCount: b.objectives.length,
        evaluable: b.objectives.length > 0,
      }));
    res.json({ books, types: ALL_TYPES, difficulties: DIFFICULTIES });
  } catch (err) {
    logger.error({ err }, "evaluable meta failed");
    res.status(500).json({ error: "Failed to load metadata" });
  }
});

export default router;
