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
import { evaluations, evaluationQuestions, levelScales } from "@workspace/db";
import type { Difficulty, QuestionType } from "@workspace/db";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import {
  getBookById,
  getObjectivesForBook,
  objectivesAreWithinBook,
  resolveObjectiveIds,
} from "@workspace/curriculum";
import { authMiddleware, type AuthenticatedRequest } from "../middlewares/auth.js";
import { logger } from "../lib/logger";
import { generateMockEvaluation } from "../modules/assessment/mockGenerator";
import { validateGenerated } from "../modules/assessment/validator";
import { QUESTION_TYPES } from "../modules/assessment/questionTypes";
import { COMPETENCY_KEYS, type CompetencyKey } from "../modules/assessment/competency";

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
        levelScaleId: defaultScale?.id ?? null,
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
    const rows = await db
      .select({
        id: evaluations.id,
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
      })
      .from(evaluations)
      .where(eq(evaluations.teacherId, req.user!.id))
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

    const result = generateMockEvaluation({
      objectives,
      assessmentTypes: evaluation.assessmentTypes,
      count: evaluation.targetQuestionCount,
      difficulty: evaluation.difficulty,
    });

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

    const totalMarks = await recomputeTotal(evaluation.id);

    res.json({
      questions: await liveQuestions(evaluation.id),
      totalMarks,
      requested: evaluation.targetQuestionCount,
      produced: validation.accepted.length,
      // Everything the generator declined or the validator dropped, stated
      // plainly. A teacher seeing 12 of 15 should know why, not wonder.
      unavailableTypes: result.unavailableTypes,
      rejected: validation.rejected,
      warnings: [...result.notes, ...validation.warnings],
    });
  } catch (err) {
    logger.error({ err }, "generate evaluation failed");
    res.status(500).json({ error: "Generation failed" });
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

    const [updated] = await db
      .update(evaluations)
      .set({
        status: "published",
        publishedAt: new Date(),
        updatedAt: new Date(),
        totalMarks: total.toFixed(2),
      })
      .where(eq(evaluations.id, evaluation.id))
      .returning();

    res.json({ evaluation: updated });
  } catch (err) {
    logger.error({ err }, "publish failed");
    res.status(500).json({ error: "Failed to publish" });
  }
});

/**
 * Books a teacher can actually build an evaluation from.
 *
 * Math S1 units 2–4 have lessons but no objectives, so offering them would put
 * a teacher in front of a generator with no curriculum behind it. Better to say
 * the unit is not ready than to invent questions for it.
 */
router.get("/evaluations/meta/evaluable", async (_req: AuthenticatedRequest, res) => {
  try {
    const books = ["book-math-10", "book-math-10-s2", "book-chem-10", "book-finlit-10"]
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
